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
import {Type, PrimitiveType} from "./Type"

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
        public stmts:NativeTaichiAny[] = []
    ){

    }

    static makeInt32Scalar(stmt:NativeTaichiAny) : Value{
        return new Value(new Type(PrimitiveType.i32),[stmt])
    }
    static makeFloat32Scalar(stmt:NativeTaichiAny) : Value{
        return new Value(new Type(PrimitiveType.f32),[stmt])
    }
    static apply1ElementWise(val:Value, f: (stmt :NativeTaichiAny) => NativeTaichiAny ):Value{
        let result = new Value(val.type, [])
        for(let stmt of val.stmts){
            result.stmts.push(f(stmt))
        }
        return result
    }
    static apply2<T>(left:Value, right:Value,allowBroadcastLeftToRight:boolean, allowBroadcastRightToLeft:boolean, 
                     f: (left :NativeTaichiAny, right :NativeTaichiAny) => T):Value{
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
            assert(left.type.numRows == right.type.numRows && left.type.numRows == right.type.numRows, "matrix shape mismatch") 
        }
        if (broadcastLeftToRight){
            let result = new Value(left.type)
            for(let stmt of left.stmts){
                let resultStmt = f(stmt,right.stmts[0])
                if(resultStmt !== undefined){
                    result.stmts.push(resultStmt)
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
            return result
        }
        else{
            let result = new Value(right.type)
            for(let i = 0; i< left.stmts.length; ++ i ){
                let resultStmt = f(left.stmts[i],right.stmts[i])
                result.stmts.push(resultStmt)
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
            let invocations = Number(rangeHint)
            result.push({
                code:wgsl,
                invocations,
                bindings: this.bindings
            })
        }
        return result
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
            default: {
                return val
            }
        }
    }


    protected override visitNumericLiteral(node: ts.NumericLiteral) : VisitorResult<Value> {
        let value = Number(node.text)
        if(node.text.includes(".")){
            return Value.makeFloat32Scalar(this.irBuilder.get_float32(value))
        }
        else{
            return Value.makeInt32Scalar(this.irBuilder.get_int32(value))
        }
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value> {
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let rightValue = this.evaluate(right)
        let op = node.operatorToken
        switch(op.kind){
            case (ts.SyntaxKind.EqualsToken): {
                Value.apply2(left,rightValue,false,true,(l, r) => this.irBuilder.create_global_ptr_global_store(l,r))
                return right
            }
            case (ts.SyntaxKind.PlusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_add(l,r))
            }
            case (ts.SyntaxKind.MinusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_sub(l,r))
            }
            case (ts.SyntaxKind.AsteriskToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_mul(l,r))
            }
            case (ts.SyntaxKind.SlashToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true, (l, r) => this.irBuilder.create_div(l,r))
            }
            case (ts.SyntaxKind.CommaToken): {
                let leftValue = this.evaluate(left)
                assert(leftValue.type.primitiveType === rightValue.type.primitiveType,"primitive type mismatch")
                let resultStmts = leftValue.stmts.concat(rightValue.stmts)
                let type = new Type(leftValue.type.primitiveType,false,leftValue.type.numRows,leftValue.type.numCols)
                if(leftValue.type.isScalar && rightValue.type.isScalar){
                    type.numRows = 2
                }
                else if(leftValue.type.isVector() && rightValue.type.isScalar){
                    type.numRows += 1
                }
                else{
                    error("malformed comma")
                }
                // More advanced concats: need to revisit
                // else if(leftValue.type.isScalar && rightValue.type.isVector()){
                //     type.numRows += rightValue.type.numRows
                // }
                // else if(leftValue.type.isVector() && rightValue.type.isVector()){
                //     assert(leftValue.type.numRows === rightValue.type.numRows,"numRows mismatch")
                //     type.numCols = leftValue.type.numRows
                //     type.numRows = 2
                // }
                // else if(leftValue.type.isMatrix() && rightValue.type.isVector()){
                //     assert(leftValue.type.numCols === rightValue.type.numRows,"numRows mismatch")
                //     type.numRows += 1
                // }
                // else if(leftValue.type.isVector() && rightValue.type.isMatrix()){
                //     assert(leftValue.type.numCols === rightValue.type.numRows,"numRows mismatch")
                //     type.numRows += 1
                // }
                return new Value(type,resultStmts)
            }
            default:
                error("Unrecognized binary operator")
        }
    }

    protected visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
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
        error("malformed element access")
        
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        let symbol = this.typeChecker!.getSymbolAtLocation(node)!
        if(!this.symbolTable.has(symbol)){
            error("Symbol not found: ",node,node.text,symbol)
        }
        let result = this.symbolTable.get(symbol)
        console.log(result)
        return result
    }
    
    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<Value> {
        assert(node.initializer.kind === ts.SyntaxKind.VariableDeclarationList, "Expecting variable declaration list, got",node.initializer.kind)
        let declarationList = node.initializer as ts.VariableDeclarationList
        assert(declarationList.declarations.length === 1, "Expecting exactly 1 delcaration")
        let loopIndexDecl = declarationList.declarations[0]
        assert(loopIndexDecl.name.kind === ts.SyntaxKind.Identifier, "Expecting identifier")
        let loopIndexIdentifer = loopIndexDecl.name as ts.Identifier
        let loopIndexSymbol = this.typeChecker!.getSymbolAtLocation(loopIndexIdentifer)! 

        assert(node.expression.kind === ts.SyntaxKind.CallExpression, "Expecting a range() call")
        let callExpr = node.expression as ts.CallExpression
        let calledFuntionExpr = callExpr.expression
        assert(calledFuntionExpr.kind === ts.SyntaxKind.Identifier, "Expecting a range() call")
        let calledFunctionName = (calledFuntionExpr as ts.Identifier).text
        assert(calledFunctionName === "range", "Expecting a range() call")

        assert(callExpr.arguments.length === 1, "Expecting exactly 1 argument in range()")
        let rangeLengthExpr = callExpr.arguments[0]
        assert(rangeLengthExpr.kind === ts.SyntaxKind.NumericLiteral)
        let rangeLengthLiteral = rangeLengthExpr as ts.NumericLiteral

        let rangeLength = Number(rangeLengthLiteral.text)

        assert(Number.isInteger(rangeLength), "range length must be an integer")

        let zero = this.irBuilder.get_int32(0)    
        let nStmt = this.irBuilder.get_int32(rangeLength)
    
        let loop = this.irBuilder.create_range_for(zero, nStmt, 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let indexStmt = this.irBuilder.get_loop_index(loop,0);
        let indexValue = Value.makeInt32Scalar(indexStmt)
        
        this.symbolTable.set(loopIndexSymbol, indexValue)

        this.dispatchVisit(node.statement)

        loopGuard.delete()
    }
}