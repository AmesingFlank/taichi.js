import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor, VisitorResult} from "./ast/Visiter"
import { CompiledKernel, TaskParams, BufferBinding, BufferType } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import { nativeTint} from '../native/tint/GetTint' 
import {error, assert} from '../utils/Logging'
import { GlobalScope } from "../program/GlobalScope";
import { Field } from "../program/Field";
import { Program } from "../program/Program";
import {getStmtKind, StmtKind} from "./Stmt"
import {Type, PrimitiveType, toNativePrimitiveType} from "./Type"

export class CompilerContext {
    private host: InMemoryHost
    constructor(){
        this.host = new InMemoryHost()
    }

    public createProgramFromSource(source: string, options: ts.CompilerOptions) {
        let tempFileName = "temp.js"
        this.host.writeFile(tempFileName,source)
        return ts.createProgram([tempFileName], options, this.host);
    }
}      
class Value {
    public constructor(
        public type:Type,
        public stmts:NativeTaichiAny[] = [],
        public compileTimeConstants: number [] = []
    ){

    }

    public isCompileTimeConstant():boolean{
        assert(this.compileTimeConstants.length === this.stmts.length || this.compileTimeConstants.length === 0, "invalid amount of constants")
        return this.compileTimeConstants.length === this.stmts.length
    }

    static makeConstantScalar(val:number, stmt:NativeTaichiAny, primitiveType:PrimitiveType) : Value{
        return new Value(new Type(primitiveType),[stmt],[val])
    } 
    static apply1ElementWise(val:Value, 
                             f: (stmt :NativeTaichiAny) => NativeTaichiAny, 
                             fConst: ((val:number) => number)|null = null):Value{
        let result = new Value(val.type, [])
        for(let stmt of val.stmts){
            result.stmts.push(f(stmt))
        }
        if(fConst && val.isCompileTimeConstant()){
            for(let x of val.compileTimeConstants){
                result.compileTimeConstants.push(fConst(x))
            }
        }
        return result
    }
    static apply2<T>(left:Value, right:Value,allowBroadcastLeftToRight:boolean, allowBroadcastRightToLeft:boolean, 
                     f: (left :NativeTaichiAny, right :NativeTaichiAny) => T,
                     fConst: ((left:number, right:number) => number)|null = null
                     ):Value{
        let broadcastLeftToRight = false
        let broadcastRightToLeft = false
        if(left.type.isScalar && !right.type.isScalar){
            assert(allowBroadcastRightToLeft, "broadcast right to left not allowed")
            broadcastRightToLeft = true     
        }
        if(!left.type.isScalar && right.type.isScalar){
            assert(allowBroadcastLeftToRight, "broadcast left to right not allowed") 
            broadcastLeftToRight = true      
        }
        if(!left.type.isScalar && !right.type.isScalar){
            assert(left.type.numRows === right.type.numRows && left.type.numCols === right.type.numCols, 
                "matrix shape mismatch ",left.type, right.type) 
        }
        if (broadcastLeftToRight){
            let result = new Value(left.type)
            for(let stmt of left.stmts){
                let resultStmt = f(stmt,right.stmts[0])
                if(resultStmt !== undefined){
                    result.stmts.push(resultStmt)
                }
            }
            if(fConst && left.isCompileTimeConstant() && right.isCompileTimeConstant()){
                for(let leftVal of left.compileTimeConstants){
                    let resultVal = fConst(leftVal,right.compileTimeConstants[0])
                    result.compileTimeConstants.push(resultVal)
                }
            }
            return result
        }
        else if (broadcastRightToLeft){
            let result = new Value(right.type)
            for(let stmt of right.stmts){
                let resultStmt = f(left.stmts[0],stmt)
                if(resultStmt !== undefined){
                    result.stmts.push(resultStmt)
                }
            }
            if(fConst && left.isCompileTimeConstant() && right.isCompileTimeConstant()){
                for(let rightVal of right.compileTimeConstants){
                    let resultVal = fConst(left.compileTimeConstants[0], rightVal)
                    result.compileTimeConstants.push(resultVal)
                }
            }
            return result
        }
        else{
            let result = new Value(right.type)
            for(let i = 0; i< left.stmts.length; ++ i ){
                let resultStmt = f(left.stmts[i],right.stmts[i])
                result.stmts.push(resultStmt)
            }
            if(fConst && left.isCompileTimeConstant() && right.isCompileTimeConstant()){
                for(let i = 0; i< left.stmts.length; ++ i ){
                    let resultVal = fConst(left.compileTimeConstants[i],right.compileTimeConstants[i])
                    result.compileTimeConstants.push(resultVal)
                }
            }
            return result
        }
    }
}

export class OneTimeCompiler extends ASTVisitor<Value>{ // It's actually a ASTVisitor<Stmt>, but we don't have the types yet
    constructor(private scope: GlobalScope){
        super()
        this.context = new CompilerContext()
        this.symbolTable = new Map<ts.Symbol,Value>()
    }
    private context: CompilerContext
    private tsProgram?: ts.Program
    private typeChecker? : ts.TypeChecker

    private symbolTable : Map<ts.Symbol, Value>;
 
    private bindings: BufferBinding[] = []

    private irBuilder : NativeTaichiAny
    public kernelName:string|null = null

    compileKernel(code: any) : TaskParams[] {
        let codeString = code.toString()
        this.irBuilder  = new nativeTaichi.IRBuilder()

        let tsOptions: ts.CompilerOptions = {
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.Latest,
            allowJs: true,
            strict: false,
            noImplicitUseStrict: true,
            alwaysStrict: false,
            strictFunctionTypes: false,
            checkJs: true
        };

        this.tsProgram = this.context.createProgramFromSource(codeString,tsOptions)
        this.typeChecker = this.tsProgram.getTypeChecker()
        
        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file, got ",sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement")
        assert(statements[0].kind === ts.SyntaxKind.FunctionDeclaration, "Expecting a function declaration")

        let kernelFunction = statements[0] as ts.FunctionDeclaration
        this.kernelName = kernelFunction.name!.text
        this.visitEachChild(kernelFunction.body!)

        let kernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram,this.irBuilder , this.kernelName, false)
        Program.getCurrentProgram().nativeAotBuilder.add(this.kernelName, kernel);

        let tasks = nativeTaichi.get_kernel_params(Program.getCurrentProgram().nativeAotBuilder,this.kernelName);
        let result:TaskParams[] = []
        let numTasks = tasks.size()
        for(let i = 0; i < numTasks; ++ i){
            let task = tasks.get(i)
            let spirvUint32Vec = task.get_spirv_ptr()
            let numWords = spirvUint32Vec.size()
            let spv:number[] = []
            for(let j = 0 ; j < numWords; ++ j){
                spv.push(spirvUint32Vec.get(j))
            }
            let wgsl = nativeTint.tintSpvToWgsl(spv)
            let rangeHint:string = task.get_range_hint()
            let invocations:number = Number(rangeHint)
            result.push({
                code:wgsl,
                invocations,
                bindings: this.bindings
            })
        }
        return result
    }

    private getNodeSymbol(node: ts.Node): ts.Symbol{
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if(symbol === undefined){
            error("symbol not found for ",node)
        }
        return symbol!
    }

    private addBinding(binding:BufferBinding) {
        for(let b of this.bindings){
            if(b.equals(binding)){
                return
            }
        }
        this.bindings.push(binding)
    }

    private evaluate(val:Value) : Value{
        assert(val.stmts.length > 0, "val is empty")
        let kind = getStmtKind(val.stmts[0])
        switch(kind){
            case StmtKind.GlobalPtrStmt: {
                return Value.apply1ElementWise(val, (ptr) => this.irBuilder.create_global_ptr_global_load(ptr))
            }
            case StmtKind.AllocaStmt: {
                return Value.apply1ElementWise(val, (ptr) => this.irBuilder.create_local_load(ptr))
            }
            default: {
                return val
            }
        }
    }

    private comma(leftValue:Value, rightValue:Value):Value{
        assert(leftValue.type.primitiveType === rightValue.type.primitiveType,"primitive type mismatch")
        let resultStmts = leftValue.stmts.concat(rightValue.stmts)
        let resultConstexprs = leftValue.compileTimeConstants.concat(rightValue.compileTimeConstants)
        let type = new Type(leftValue.type.primitiveType,false,leftValue.type.numRows,leftValue.type.numCols)
        if(leftValue.type.isScalar && rightValue.type.isScalar){
            type.numRows = 2
        }
        else if(leftValue.type.isVector() && rightValue.type.isScalar){
            type.numRows += 1
        }
        else if(leftValue.type.isVector() && rightValue.type.isVector()){
            assert(leftValue.type.numRows === rightValue.type.numRows,"numRows mismatch")
            type.numCols = leftValue.type.numRows
            type.numRows = 2
        }
        else if(leftValue.type.isMatrix() && rightValue.type.isVector()){
            assert(leftValue.type.numCols === rightValue.type.numRows,"numRows mismatch")
            type.numRows += 1
        }
        else{
            error("malformed comma")
        }
        return new Value(type,resultStmts,resultConstexprs)
    }


    protected override visitNumericLiteral(node: ts.NumericLiteral) : VisitorResult<Value> {
        let value = Number(node.text)
        if(node.text.includes(".")){
            return Value.makeConstantScalar(value,this.irBuilder.get_float32(value),PrimitiveType.f32)
        }
        else{
            return Value.makeConstantScalar(value,this.irBuilder.get_int32(value),PrimitiveType.i32)
        }
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value> {
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let rightValue = this.evaluate(right)
        let op = node.operatorToken
        switch(op.kind){
            case (ts.SyntaxKind.EqualsToken): {
                let leftStmtKind = getStmtKind(left.stmts[0])
                switch(leftStmtKind){
                    case StmtKind.GlobalPtrStmt:{
                        Value.apply2(left,rightValue,false,true,(l, r) => this.irBuilder.create_global_ptr_global_store(l,r))
                        return right
                    }
                    case StmtKind.AllocaStmt:{
                        Value.apply2(left,rightValue,false,true,(l, r) => this.irBuilder.create_local_store(l,r))
                        return right
                    }
                    default:{
                        error("Invalid assignment ",leftStmtKind)
                    }
                }
            }
            case (ts.SyntaxKind.PlusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_add(l,r), (l,r)=>l+r)
            }
            case (ts.SyntaxKind.MinusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_sub(l,r), (l,r)=>l-r)
            }
            case (ts.SyntaxKind.AsteriskToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_mul(l,r), (l,r)=>l*r)
            }
            case (ts.SyntaxKind.SlashToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_div(l,r), (l,r)=>l/r)
            }
            case (ts.SyntaxKind.CommaToken): {
                let leftValue = this.evaluate(left)
                return this.comma(leftValue,rightValue)
            }
            default:
                error("Unrecognized binary operator")
        }
    }

    protected override visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): VisitorResult<Value> {
        let elements = node.elements
        assert(elements.length > 0, "cannot have empty arrays")
        let value = this.evaluate(this.extractVisitorResult(this.dispatchVisit(elements[0])))
        if(elements.length === 1){
            if(value.type.isScalar){
                value.type.isScalar = false
            }
            return value
        }
        for(let i = 1; i<elements.length;++i){
            let nextValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(elements[i])))
            value = this.comma(value,nextValue)
        }
        return value
    }

    protected override visitParenthesizedExpression(node: ts.ParenthesizedExpression): VisitorResult<Value> {
        return this.extractVisitorResult(this.dispatchVisit(node.expression))
    }

    protected override visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
        let base = node.expression
        let argument = node.argumentExpression
        if(base.kind === ts.SyntaxKind.Identifier){
            let baseName = base.getText()
            if(this.scope.hasStored(baseName)){
                let hostSideValue:any = this.scope.getStored(baseName)
                if( hostSideValue instanceof Field){
                    let field = hostSideValue as Field
                    let binding = new BufferBinding(BufferType.Root, field.snodeTree.treeId, field.snodeTree.treeId)
                    this.addBinding(binding)

                    let resultType = field.elementType
                    let result = new Value(resultType)

                    let argumentValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(argument)))
                    assert(argumentValue.stmts.length === field.dimensions.length, "field access dimension mismatch ",argumentValue.stmts.length , field.dimensions.length)
                    let accessVec : NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
                    for(let stmt of argumentValue.stmts){
                        accessVec.push_back(stmt)
                    }

                    for(let place of field.placeNodes){
                        let ptr = this.irBuilder.create_global_ptr(place,accessVec);
                        result.stmts.push(ptr)
                    }
                    return result
                }
            }
        }
        let baseValue = this.extractVisitorResult(this.dispatchVisit(base))
        let argumentValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(argument)))
        assert(!argumentValue.type.isMatrix(), "index cannot be a matrix")
        assert(!baseValue.type.isScalar, "cannot index a scalar")
        assert(argumentValue.isCompileTimeConstant())

        let type = new Type( baseValue.type.primitiveType)
        let result = new Value(type)
        let indices = argumentValue.compileTimeConstants
        if(baseValue.type.isVector()){
            assert(indices.length === 1, "vector can only have 1 index")
            result.stmts.push(baseValue.stmts[indices[0]])
            if(baseValue.isCompileTimeConstant()){
                result.compileTimeConstants.push(baseValue.stmts[indices[0]])
            }
        }
        else if(baseValue.type.isMatrix()){
            assert(indices.length == 2, "matrix can only have at most 2 indices")
            let index = indices[0]*baseValue.type.numCols+indices[1]
            result.stmts.push(baseValue.stmts[index])
            if(baseValue.isCompileTimeConstant()){
                result.compileTimeConstants.push(baseValue.stmts[index])
            } 
        }

        return result
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        let symbol = this.getNodeSymbol(node)
        if(!this.symbolTable.has(symbol)){
            error("Symbol not found: ",node,node.text,symbol)
        }
        let result = this.symbolTable.get(symbol)
        return result
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value> {
        let identifier = node.name
        if(!node.initializer){
            error("variable declaration must have an identifier")
        }
        let initializer = node.initializer!
        let initValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(initializer)))
        let varType = initValue.type
        let varValue = new Value(varType)
        for(let i = 0; i < initValue.stmts.length;++i){
            let alloca = this.irBuilder.create_local_var(toNativePrimitiveType(varType.primitiveType))
            varValue.stmts.push(alloca)
            this.irBuilder.create_local_store(alloca, initValue.stmts[i])
        }
        let varSymbol = this.getNodeSymbol(identifier)
        this.symbolTable.set(varSymbol, varValue)
        return varValue
    }

    private visitRangeFor(indexSymbols:ts.Symbol[], rangeExpr:ts.NodeArray<ts.Expression>, body:ts.Statement) : VisitorResult<Value>{
        assert(rangeExpr.length === 1, "Expecting exactly 1 argument in range()")
        assert(indexSymbols.length === 1, "Expecting exactly 1 loop index range()")
        let rangeLengthExpr = rangeExpr[0]
        let rangeLengthValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(rangeLengthExpr)))
        assert(rangeLengthValue.type.primitiveType === PrimitiveType.i32, "range must be i32")
        let zero = this.irBuilder.get_int32(0)
        let loop = this.irBuilder.create_range_for(zero, rangeLengthValue.stmts[0], 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let indexStmt = this.irBuilder.get_loop_index(loop,0);
        let indexValue = new Value(new Type(PrimitiveType.i32),[indexStmt])
        
        this.symbolTable.set(indexSymbols[0], indexValue)

        this.dispatchVisit(body)

        loopGuard.delete()
    }

    // private visitNdrangeFor(indexSymbols:ts.Symbol[], rangeExpr:ts.NodeArray<ts.Expression>, body:ts.Statement) : VisitorResult<Value>{
    //     assert(indexSymbols.length === 1, "Expecting exactly 1 loop index ndrange()")

    //     let lengthValues: Value[] = []
    //     for(let lengthExpr of rangeExpr){
    //         let value = this.evaluate(this.extractVisitorResult(this.dispatchVisit(lengthExpr)))
    //         assert(value.type.primitiveType === PrimitiveType.i32, "range must be i32")
    //         lengthValues.push(value)
    //     }
    //      let rangeLengthExpr = rangeExpr[0]
    //     let rangeLengthValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(rangeLengthExpr)))
    //     assert(rangeLengthValue.type.primitiveType === PrimitiveType.i32, "range must be i32")
    //     let zero = this.irBuilder.get_int32(0)
    //     let loop = this.irBuilder.create_range_for(zero, rangeLengthValue.stmts[0], 0, 4, 0, false);

    //     let loopGuard = this.irBuilder.get_range_loop_guard(loop);
    //     let indexStmt = this.irBuilder.get_loop_index(loop,0);
    //     let indexValue = new Value(new Type(PrimitiveType.i32),[indexStmt])
        
    //     this.symbolTable.set(indexSymbols[0], indexValue)

    //     this.dispatchVisit(body)

    //     loopGuard.delete()
    // }
    
    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<Value> {
        assert(node.initializer.kind === ts.SyntaxKind.VariableDeclarationList, "Expecting variable declaration list, got",node.initializer.kind)
        let declarationList = node.initializer as ts.VariableDeclarationList
        let loopIndexSymbols:ts.Symbol[] = []
        for(let decl of declarationList.declarations){
            let ident = decl.name as ts.Identifier
            let symbol = this.getNodeSymbol(ident)
            loopIndexSymbols.push(symbol)
        }

        if(node.expression.kind === ts.SyntaxKind.CallExpression){
            let callExpr = node.expression as ts.CallExpression
            let calledFunctionExpr = callExpr.expression
            let calledFunctionText = calledFunctionExpr.getText()
            if(calledFunctionText === "range" || calledFunctionText === "ti.range"){
                return this.visitRangeFor(loopIndexSymbols,callExpr.arguments, node.statement)
            }
            else{
                error("unsupported for-of initializer: ", calledFunctionText)
            }
        }
        else{
            error("range for not supported yet")
        }
    }
}