import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor, VisitorResult} from "./ast/Visiter"
import { CompiledKernel, TaskParams, BufferBinding, BufferType, KernelParams} from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import { nativeTint} from '../native/tint/GetTint' 
import {error, assert} from '../utils/Logging'
import { GlobalScope } from "../program/GlobalScope";
import { Field } from "../program/Field";
import { Program } from "../program/Program";
import {getStmtKind, StmtKind} from "./Stmt"
import {Type, PrimitiveType, toNativePrimitiveType} from "./Type"
import {getWgslShaderBindings} from "./WgslReflection"
export class CompilerContext {
    protected host: InMemoryHost
    constructor(){
        this.host = new InMemoryHost()
    }

    public createProgramFromSource(source: string, options: ts.CompilerOptions) {
        let tempFileName = "temp.js"
        this.host.writeFile(tempFileName,source)
        return ts.createProgram([tempFileName], options, this.host);
    }
}      

enum DatatypeTransform {
    PromoteToMatch, //binary only
    Unchanged, // unary only
    AlwaysF32,
    AlwaysI32,
    DontCare
}


class ResultOrError<T> {
    private constructor(public isError:boolean, public result:T|null, public errorMessage:string|null){
        if(isError){
            assert(result === null && errorMessage !== null)
        }
        else{
            assert(result !== null && errorMessage === null)
        }
    }
    public static createResult<Y>(result:Y): ResultOrError<Y>{
        return new ResultOrError<Y>(false,result,null)
    } 
    public static createError<Y>(msg:string): ResultOrError<Y>{
        return new ResultOrError<Y>(true,null,msg)
    } 
}  

class Value {
    public constructor(
        type_:Type,
        public stmts:NativeTaichiAny[] = [],
        public compileTimeConstants: number [] = []
    ){
        this.type_ = type_.copy()
    }

    private type_:Type

    public get type():Type {
        return this.type_;
    }

    public set type(newType:Type) {
        this.type_ = newType.copy()
    }

    public isCompileTimeConstant():boolean{
        return this.compileTimeConstants.length === this.stmts.length
    }

    static makeConstantScalar(val:number, stmt:NativeTaichiAny, primitiveType:PrimitiveType) : Value{
        return new Value(new Type(primitiveType),[stmt],[val])
    } 
    static apply1ElementWise(val:Value, datatypeTransform:DatatypeTransform,
                             f: (stmt :NativeTaichiAny) => NativeTaichiAny, 
                             fConst: ((val:number) => number)|null = null): ResultOrError<Value>{
        let result = new Value(val.type, [])
        for(let stmt of val.stmts){
            result.stmts.push(f(stmt))
        }
        if(fConst && val.isCompileTimeConstant()){
            for(let x of val.compileTimeConstants){
                result.compileTimeConstants.push(fConst(x))
            }
        }
        switch(datatypeTransform){
            case DatatypeTransform.AlwaysF32: {
                result.type.primitiveType = PrimitiveType.f32
                break;
            }
            case DatatypeTransform.AlwaysI32: {
                result.type.primitiveType = PrimitiveType.i32
                break;
            }
        }
        return ResultOrError.createResult(result)
    }
    static apply2<T>(left:Value, right:Value,allowBroadcastLeftToRight:boolean, allowBroadcastRightToLeft:boolean, 
                     datatypeTransform:DatatypeTransform,
                     f: (left :NativeTaichiAny, right :NativeTaichiAny) => T,
                     fConst: ((left:number, right:number) => number)|null = null
                     ): ResultOrError<Value>{
        let broadcastLeftToRight = false
        let broadcastRightToLeft = false
        if(left.type.isScalar && !right.type.isScalar){
            if(!allowBroadcastLeftToRight){
                return ResultOrError.createError("broadcast left to right not allowed")
            }
            broadcastLeftToRight = true     
        }
        if(!left.type.isScalar && right.type.isScalar){
            if (!allowBroadcastRightToLeft){
                return ResultOrError.createError("broadcast right to left not allowed")
            }  
            broadcastRightToLeft = true      
        }
        if(!left.type.isScalar && !right.type.isScalar){
            if(left.type.numRows !== right.type.numRows){
                return ResultOrError.createError(`numRows mismatch ${left.type.numRows} !== ${right.type.numRows}`)
            } 
            if(left.type.numCols !== right.type.numCols){
                return ResultOrError.createError(`numCols mismatch ${left.type.numCols} !== ${right.type.numCols}`)
            }  
        }
        let result:Value
        if (broadcastRightToLeft){
            result = new Value(left.type)
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
        }
        else if (broadcastLeftToRight){
            result = new Value(right.type)
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
        }
        else{
            result = new Value(right.type)
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
        }
        switch(datatypeTransform){
            case DatatypeTransform.PromoteToMatch: {
                if(left.type.primitiveType === PrimitiveType.f32 || right.type.primitiveType === PrimitiveType.f32){
                    result.type.primitiveType = PrimitiveType.f32
                }
                else{
                    result.type.primitiveType = PrimitiveType.i32
                }
                break
            }
            case DatatypeTransform.AlwaysF32: {
                result.type.primitiveType = PrimitiveType.f32
                break;
            }
            case DatatypeTransform.AlwaysI32: {
                result.type.primitiveType = PrimitiveType.i32
                break;
            }
        }
        return ResultOrError.createResult(result)
    }
}


enum LoopKind {
    For, While
}

class BuiltinOp {
    constructor(
        public name:string,
        public numArgs:number,
        public typeTransform: DatatypeTransform,
        public valueTransform?: (()=>Value) | ((x:Value) => Value) |  ((x:Value, y:Value) => Value),
        public stmtTransform?: (()=>NativeTaichiAny) | ((x:NativeTaichiAny) => NativeTaichiAny) |  ((x:NativeTaichiAny, y:NativeTaichiAny) => NativeTaichiAny)
    ){
        if(stmtTransform){
            if(numArgs === 0){
                this.valueTransform = () : Value => {
                     let primType = PrimitiveType.f32
                    if(typeTransform === DatatypeTransform.AlwaysF32){
                    }
                    else if(typeTransform === DatatypeTransform.AlwaysI32){
                        primType = PrimitiveType.i32
                    }
                    else{
                        error( "only allows AlwaysI32 or AlwaysF32 for 0-arg ops")
                    }
                    let result = new Value(new Type(primType))
                    let func = stmtTransform as () => NativeTaichiAny
                    result.stmts.push(func())
                    return result
                }
            }
            else if( numArgs === 1){
                this.valueTransform = (v:Value):Value => {
                    return this.extractValueOrError( Value.apply1ElementWise(v,typeTransform, stmtTransform as (stmt:NativeTaichiAny) => NativeTaichiAny)) 
                } 
            }
            else{// if(numArgs === 2)
                this.valueTransform = (l:Value,r:Value):Value => {
                    return this.extractValueOrError( Value.apply2(l,r,true,true, typeTransform, stmtTransform as (l:NativeTaichiAny, r:NativeTaichiAny) => NativeTaichiAny))
                } 
            }
        }
    } 
    protected extractValueOrError(valueOrError: ResultOrError<Value>, ...args:any): Value {
        if(valueOrError.isError){
             error ("Built-in op error", valueOrError.errorMessage, ...args) // this is an internal-error, likely cuased by a compiler bug
        }
        return valueOrError.result!
    }
    apply0(): Value{
        assert(this.numArgs === 0, "expecting 0 arguments for "+this.name)
        let func = this.valueTransform! as () => Value
        return func()
    }
    apply1(v:Value): Value{
        assert(this.numArgs === 1, "expecting 1 arguments for "+this.name)
        let func = this.valueTransform! as (v:Value) => Value
        return func(v)
    }
    apply2(l:Value,r:Value):Value{
        assert(this.numArgs === 2, "expecting 2 arguments for "+this.name)
        let func = this.valueTransform! as (l:Value,r:Value) => Value
        return func(l, r)
    }
}

class CompilingVisitor extends ASTVisitor<Value>{ // It's actually a ASTVisitor<Stmt>, but we don't have the types yet
    constructor(protected irBuilder:NativeTaichiAny, protected scope: GlobalScope){
        super()
        this.context = new CompilerContext()
        this.symbolTable = new Map<ts.Symbol,Value>()
    }
    protected context: CompilerContext
    protected tsProgram?: ts.Program
    protected typeChecker? : ts.TypeChecker

    protected symbolTable : Map<ts.Symbol, Value>;
 
    public compilationResultName:string|null = null

    protected loopStack: LoopKind[] = []

    protected numArgs:number = 0
    protected hasRet:boolean = false
    protected lastVisitedNode: ts.Node|null = null
 
    buildIR(code:any){
        let codeString = code.toString()

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
        this.errorTsDiagnostics(this.tsProgram.getSyntacticDiagnostics())
        this.typeChecker = this.tsProgram.getTypeChecker()
        
        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file, got ",sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement in ti.kernel (A single function or arrow function)")
        if(statements[0].kind === ts.SyntaxKind.FunctionDeclaration){
            let func = statements[0] as ts.FunctionDeclaration
            this.compilationResultName = func.name!.text
            this.registerArguments(func.parameters)
            this.visitEachChild(func.body!)
        }
        else if(statements[0].kind === ts.SyntaxKind.ExpressionStatement && 
                (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction){
            let func = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(func.parameters)
            let body = func.body
            if(body.kind === ts.SyntaxKind.Block){
                this.visitEachChild(func.body)
            }
            else{
                // then this is an immediately-returning function, e.g. (x,y) => x+y
                let returnStmt = ts.factory.createReturnStatement(func.body as ts.Expression)
                this.visitReturnStatement(returnStmt)
            }
        }
    }

    protected override dispatchVisit(node: ts.Node): VisitorResult<Value> {
        this.lastVisitedNode = node
        return super.dispatchVisit(node)
    }

    protected override extractVisitorResult(result: VisitorResult<Value>): Value {
        this.assertNode(null, result !== undefined, "VistorResult is undefined")
        return super.extractVisitorResult(result)
    }

    protected extractValueOrError(valueOrError: ResultOrError<Value>, node:ts.Node|null, ...args:any): Value {
        if(valueOrError.isError){
            this.errorNode(node, valueOrError.errorMessage, ...args)
        }
        return valueOrError.result!
    }

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>){
        this.numArgs = args.length
        for(let i = 0;i<this.numArgs;++i){
            // only support `number` args for ow
            let val = new Value(new Type(PrimitiveType.f32,true))
            val.stmts.push(this.irBuilder.create_arg_load(i, toNativePrimitiveType(PrimitiveType.f32), false))
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol,val)
        }
    }

    protected getNodeSymbol(node: ts.Node): ts.Symbol{
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if(symbol === undefined){
            this.errorNode(node, "symbol not found for "+node.getText())
        }
        return symbol!
    } 

    protected getSourceCodeAt(startPos:number, endPos:number):string {
        let sourceFile = this.tsProgram!.getSourceFiles()[0]
        let startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line
        let endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line

        let start = sourceFile.getLineStarts()[startLine]
        let end = sourceFile.getLineStarts()[endLine+1]
        let code = sourceFile.getText().slice(start,end)
        return code
    }

    protected errorTsDiagnostics(diags: readonly ts.DiagnosticWithLocation[]){
        let message = ""
        for(let diag of diags){
            if(diag.category === ts.DiagnosticCategory.Error){
                let startPos = diag.start
                let endPos = diag.start + diag.length
                let code = this.getSourceCodeAt(startPos,endPos)
                message += `
                Syntax Error: ${diag.messageText}   
                at:  
                ${code}
                ` 
            }
        }
        if(message !== ""){
            error("Kernel/function code cannot be parsed as Javascript: \n"+message)
        }
    }

    protected errorNode(node:ts.Node|null, ...args:any[]){
        if(node === null){
            if(this.lastVisitedNode!== null){
                this.errorNode(this.lastVisitedNode,...args)
            }
            else{
                error(...args)
            }
            return
        }
        
        let startPos = node.getStart()
        let endPos = node.getEnd()
        let code = this.getSourceCodeAt(startPos,endPos)
        let errorMessage = "Error: "
        for(let a of args){
            errorMessage += String(a)
        }
        errorMessage += `\nat:\n ${code} `
        error(errorMessage)
    }

    protected assertNode(node:ts.Node|null, condition:boolean, ...args:any[]){
        if(!condition){
            this.errorNode(node,...args)
        }
    }

    protected evaluate(val:Value) : Value{
        this.assertNode(null, val.stmts.length > 0, "value is empty")
        this.assertNode(null, val.stmts[0] !== undefined, "value is undefined")
        let kind = getStmtKind(val.stmts[0])
        switch(kind){
            case StmtKind.GlobalPtrStmt: {
                let resultOrError = Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (ptr) => this.irBuilder.create_global_ptr_global_load(ptr))
                return this.extractValueOrError(resultOrError, null)
            }
            case StmtKind.AllocaStmt: {
                let resultOrError = Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (ptr) => this.irBuilder.create_local_load(ptr))
                return this.extractValueOrError(resultOrError, null)
            }
            default: {
                return val
            }
        }
    }

    protected comma(leftValue:Value, rightValue:Value):  Value{
        let hasFloat = leftValue.type.primitiveType === PrimitiveType.f32 || rightValue.type.primitiveType === PrimitiveType.f32
        if(hasFloat){
            leftValue = this.castTo(leftValue,PrimitiveType.f32)
            rightValue = this.castTo(rightValue,PrimitiveType.f32)
        }
        let resultStmts = leftValue.stmts.concat(rightValue.stmts)
        let resultConstexprs = leftValue.compileTimeConstants.concat(rightValue.compileTimeConstants)
        let type = new Type(leftValue.type.primitiveType,false,leftValue.type.numRows,leftValue.type.numCols)
        //console.log(leftValue,rightValue,type)
        if(leftValue.type.isScalar && rightValue.type.isScalar){
            type.numRows = 2
        }
        else if(leftValue.type.isVector() && rightValue.type.isScalar){
            type.numRows += 1
        }
        else if(leftValue.type.isVector() && rightValue.type.isVector() && leftValue.type.numRows === rightValue.type.numRows){
            type.numCols = leftValue.type.numRows
            type.numRows = 2
        }
        else if(leftValue.type.isMatrix() && rightValue.type.isVector() && leftValue.type.numCols === rightValue.type.numRows){
            type.numRows += 1
        }
        else{
            this.errorNode(null,"Type mismatch, cannot be concatenated")
        }
        return new Value(type,resultStmts,resultConstexprs)
    }

    protected castTo(val:Value, primType: PrimitiveType):Value{
        if(val.type.primitiveType === primType){
            return val
        }
        if(primType === PrimitiveType.f32){
            let resultOrError = Value.apply1ElementWise(val,DatatypeTransform.AlwaysF32,(x)=>this.irBuilder.create_cast(x, toNativePrimitiveType(PrimitiveType.f32)))
            return this.extractValueOrError(resultOrError, null)
        }
        else{ //if(primType === PrimitiveType.i32){
            let resultOrError = Value.apply1ElementWise(val,DatatypeTransform.AlwaysI32,(x)=>this.irBuilder.create_cast(x, toNativePrimitiveType(PrimitiveType.i32)))
            return this.extractValueOrError(resultOrError, null)
        }
        
    }


    protected override visitNumericLiteral(node: ts.NumericLiteral) : VisitorResult<Value> {
        let value = Number(node.getText())
        if(node.getText().includes(".")){
            return Value.makeConstantScalar(value,this.irBuilder.get_float32(value),PrimitiveType.f32)
        }
        else{
            return Value.makeConstantScalar(value,this.irBuilder.get_int32(value),PrimitiveType.i32)
        }
    }

    protected applyUnaryOp(val :Value,opToken: ts.SyntaxKind ): Value|null {
        switch(opToken){
            case ts.SyntaxKind.PlusToken:{
                return val
            }
            case ts.SyntaxKind.MinusToken:{
                return this.extractValueOrError(Value.apply1ElementWise(val, DatatypeTransform.Unchanged,(stmt)=>this.irBuilder.create_neg(stmt),(x)=>-x),null)
            }
            case ts.SyntaxKind.ExclamationToken:{
                return this.extractValueOrError(Value.apply1ElementWise(val, DatatypeTransform.Unchanged,(stmt)=>this.irBuilder.create_logical_not(stmt)),null)
            }
            case ts.SyntaxKind.TildeToken:{
                return this.extractValueOrError(Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (stmt)=>this.irBuilder.create_not(stmt)),null)
            } 
        }
        return null
    }

    protected override visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): VisitorResult<Value> {
        let val = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.operand)))
        let result = this.applyUnaryOp(val,node.operator)
        if(result !== null){
            return result
        }
        else{
            this.errorNode(node, "unsupported prefix unary operator:"+node.getText())
        }
    }

    protected applyBinaryOpOrError(leftValue:Value, rightValue:Value, opToken: ts.SyntaxKind) : ResultOrError<Value> {
         switch(opToken){
            case (ts.SyntaxKind.PlusToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_add(l,r), (l,r)=>l+r)
            }
            case (ts.SyntaxKind.MinusToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_sub(l,r), (l,r)=>l-r)
            }
            case (ts.SyntaxKind.AsteriskToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_mul(l,r), (l,r)=>l*r)
            }
            case (ts.SyntaxKind.SlashToken): {
                leftValue = this.castTo(leftValue,PrimitiveType.f32)
                rightValue = this.castTo(rightValue,PrimitiveType.f32)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysF32, (l, r) => this.irBuilder.create_truediv(l,r), (l,r)=>l/r)
            }
            case (ts.SyntaxKind.AsteriskAsteriskToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_pow(l,r))
            }
            case (ts.SyntaxKind.PercentToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_mod(l,r))
            }
            case (ts.SyntaxKind.LessThanToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_lt(l,r))
            }
            case (ts.SyntaxKind.LessThanEqualsToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_le(l,r))
            }
            case (ts.SyntaxKind.GreaterThanToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_gt(l,r))
            }
            case (ts.SyntaxKind.GreaterThanEqualsToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_ge(l,r))
            }
            case (ts.SyntaxKind.EqualsEqualsEqualsToken):
            case (ts.SyntaxKind.EqualsEqualsToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_eq(l,r))
            }
            case (ts.SyntaxKind.ExclamationEqualsEqualsToken):
            case (ts.SyntaxKind.ExclamationEqualsToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_ne(l,r))
            }
            case (ts.SyntaxKind.AmpersandToken):
            case (ts.SyntaxKind.AmpersandAmpersandToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_and(l,r))
            }
            case (ts.SyntaxKind.BarToken):
            case (ts.SyntaxKind.BarBarToken): {
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_or(l,r))
            }
            case (ts.SyntaxKind.CommaToken): {
                return ResultOrError.createResult(this.comma(leftValue,rightValue))
            }
            default:
                return ResultOrError.createError<Value>("Unrecognized binary op token. ")
        }
    } 

    protected applyBinaryOp(leftValue:Value, rightValue:Value, opToken: ts.SyntaxKind) : Value {
        let resultOrError = this.applyBinaryOpOrError(leftValue,rightValue,opToken)
        return this.extractValueOrError(resultOrError,null)
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value> {
        //console.log(node.getText())
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let rightValue = this.evaluate(right)
        let op = node.operatorToken
        if(op.kind === ts.SyntaxKind.EqualsToken){
            let leftStmtKind = getStmtKind(left.stmts[0])
            switch(leftStmtKind){
                case StmtKind.GlobalPtrStmt:{
                    this.extractValueOrError(Value.apply2(left,rightValue,false,true, DatatypeTransform.DontCare,(l, r) => this.irBuilder.create_global_ptr_global_store(l,r)),node)
                    return right
                }
                case StmtKind.AllocaStmt:{
                    this.extractValueOrError(Value.apply2(left,rightValue,false,true,DatatypeTransform.DontCare,(l, r) => this.irBuilder.create_local_store(l,r)),node)
                    return right
                }
                default:{
                    this.errorNode(node, "Invalid assignment "+leftStmtKind)
                }
            }
        }
        let leftValue = this.evaluate(left)
        let maybeResult = this.applyBinaryOpOrError(leftValue,rightValue, op.kind)
        let result = this.extractValueOrError(maybeResult,node,"Unrecognized binary operator "+op.getText())
        return result
    }

    protected override visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): VisitorResult<Value> {
        let elements = node.elements
        this.assertNode(node, elements.length > 0, "cannot have empty arrays")
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

    protected getVectorComponents(vec: Value):Value[] {
        this.assertNode(null, vec.type.isVector())
        let components:Value[] = [] 
        for(let i = 0;i<3;++i){
            components.push(new Value(new Type(vec.type.primitiveType),[vec.stmts[i]])) 
        }
        return components
    }

    protected getBuiltinOps():Map<string,BuiltinOp>{
        let builtinOps:BuiltinOp[] = [ // firstly, we have CHI IR built-ins
            //new BuiltinOp("random",0,DatatypeTransform.AlwaysF32, undefined, ()=>this.irBuilder.create_rand(toNativePrimitiveType(PrimitiveType.f32))), // doesn't work because of race-condition in spirv :))
            new BuiltinOp("sin",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_sin(stmt)),
            new BuiltinOp("cos",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_cos(stmt)),
            new BuiltinOp("asin",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_asin(stmt)),
            new BuiltinOp("acos",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_acos(stmt)),
            new BuiltinOp("tan",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_tan(stmt)),
            new BuiltinOp("tanh",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_tanh(stmt)),
            new BuiltinOp("exp",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_exp(stmt)),
            new BuiltinOp("log",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_log(stmt)),
            new BuiltinOp("neg",1, DatatypeTransform.Unchanged, undefined , (stmt:NativeTaichiAny)=>this.irBuilder.create_neg(stmt) ),
            new BuiltinOp("not",1, DatatypeTransform.AlwaysI32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_not(stmt)),
            new BuiltinOp("logical_not",1, DatatypeTransform.AlwaysI32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.logical_not(stmt)),
            new BuiltinOp("abs",1, DatatypeTransform.Unchanged, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_abs(stmt)),
            new BuiltinOp("floor",1, DatatypeTransform.AlwaysI32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_floor(stmt)),
            new BuiltinOp("sgn",1, DatatypeTransform.AlwaysI32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_sgn(stmt)), 
            new BuiltinOp("sqrt",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_sqrt(stmt)),
            new BuiltinOp("i32",1, DatatypeTransform.AlwaysI32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.i32))),
            new BuiltinOp("f32",1, DatatypeTransform.AlwaysF32, undefined, (stmt:NativeTaichiAny)=>this.irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.f32))),
            new BuiltinOp("max",2, DatatypeTransform.PromoteToMatch, undefined, (l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_max(l,r) ),
            new BuiltinOp("min",2, DatatypeTransform.PromoteToMatch, undefined, (l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_min(l,r)),
            new BuiltinOp("pow",2, DatatypeTransform.PromoteToMatch, undefined, (l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_pow(l,r)),
            new BuiltinOp("atan2",2, DatatypeTransform.AlwaysF32, undefined, (l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_atan2(l,r)),
        ]

        let opsMap = new Map<string,BuiltinOp>()
        for(let op of builtinOps){
            opsMap.set(op.name,op)
        }

        let len = new BuiltinOp("len", 1, DatatypeTransform.AlwaysI32, (v:Value) => {
            let length = v.type.numRows
            return Value.makeConstantScalar(length,this.irBuilder.get_int32(length),PrimitiveType.i32)
        })
        let length = new BuiltinOp("length", 1,DatatypeTransform.AlwaysI32,len.valueTransform!)

        let sum = new BuiltinOp("sum", 1,DatatypeTransform.Unchanged,(v:Value) => {
            this.assertNode(null, v.type.isVector(), "sum can only be applied to vectors")
            let sum = Value.makeConstantScalar(0.0,this.irBuilder.get_float32(0.0),PrimitiveType.f32)
            for(let stmt of v.stmts){
                let thisComponent = new Value(new Type(v.type.primitiveType),[stmt])
                sum = this.applyBinaryOp(sum,thisComponent, ts.SyntaxKind.PlusToken)
            }
            return sum
        })

        let norm_sqr = new BuiltinOp("norm_sqr",1,DatatypeTransform.AlwaysF32,(v:Value) => {
            this.assertNode(null, v.type.isVector(), "norm/norm_sqr can only be applied to vectors")
            let squared = this.applyBinaryOp(v,v,ts.SyntaxKind.AsteriskToken)
            let result = sum.apply1(squared)
            return result
        })

        let norm = new BuiltinOp("norm",1,DatatypeTransform.AlwaysF32,(v:Value) => {
            this.assertNode(null, v.type.isVector(), "norm/norm_sqr can only be applied to vectors")
            let resultSqr = norm_sqr.apply1(v)
            let sqrtFunc = opsMap.get("sqrt")!
            return sqrtFunc.apply1(resultSqr) 
        })

        let normalized = new BuiltinOp("normalized",1,DatatypeTransform.AlwaysF32,(v:Value) => {
            this.assertNode(null, v.type.isVector(), "normalized can only be applied to vectors")
            let normValue = norm.apply1(v)
            return this.applyBinaryOp(v,normValue,ts.SyntaxKind.SlashToken) 
        })

        let dot = new BuiltinOp("dot",2,DatatypeTransform.PromoteToMatch,(a:Value, b:Value) => {
            this.assertNode(null, a.type.isVector() && b.type.isVector(), "dot can only be applied to vectors")
            let product = this.applyBinaryOp(a,b,ts.SyntaxKind.AsteriskToken)
            return sum.apply1(product) 
        })

        let cross = new BuiltinOp("cross",2,DatatypeTransform.PromoteToMatch,(l:Value, r:Value) => {
            this.assertNode(null, l.type.isVector() && r.type.isVector() && l.type.numRows==3 && r.type.numRows==3 , "cross can only be applied to 3D vectors")
            let leftComponents:Value[] = this.getVectorComponents(l)
            let rightComponents:Value[] = this.getVectorComponents(r)
            
            let r0 = this.applyBinaryOp(
                        this.applyBinaryOp(leftComponents[1],rightComponents[2],ts.SyntaxKind.AsteriskToken),
                        this.applyBinaryOp(leftComponents[2],rightComponents[1],ts.SyntaxKind.AsteriskToken),
                    ts.SyntaxKind.MinusToken)!
            let r1 = this.applyBinaryOp(
                        this.applyBinaryOp(leftComponents[2],rightComponents[0],ts.SyntaxKind.AsteriskToken),
                        this.applyBinaryOp(leftComponents[0],rightComponents[2],ts.SyntaxKind.AsteriskToken), 
                    ts.SyntaxKind.MinusToken)! 
            let r2 = this.applyBinaryOp(
                        this.applyBinaryOp(leftComponents[0],rightComponents[1],ts.SyntaxKind.AsteriskToken),
                        this.applyBinaryOp(leftComponents[1],rightComponents[0],ts.SyntaxKind.AsteriskToken), 
                     ts.SyntaxKind.MinusToken)!  

            let result = this.comma(this.comma(r0,r1)!,r2)!
            return result
        })

        let derivedOps = [len,length, sum,norm_sqr,norm, normalized,dot, cross]
        for(let op of derivedOps){
            opsMap.set(op.name, op)
        }

        return opsMap
    }

    protected override visitCallExpression(node: ts.CallExpression): VisitorResult<Value> {
        let funcText = node.expression.getText()
        let argumentValues:Value[] = []
        for(let arg of node.arguments){
            argumentValues.push(this.evaluate(this.extractVisitorResult(this.dispatchVisit(arg))))
        }
        let checkNumArgs = (n:number)=>{
            this.assertNode(node, argumentValues.length === n, funcText+" requires "+n.toString()+" args")
        }
        
        let builtinOps = this.getBuiltinOps() 
        for(let kv of builtinOps){
            let op = kv[1]
            if(funcText === op.name || funcText === "ti."+op.name || funcText === "Math."+op.name ){
                checkNumArgs(op.numArgs)
                if(op.numArgs === 0){
                    return op.apply0()
                }
                else if(op.numArgs === 1){
                    return op.apply1(argumentValues[0])
                }
                else{// if(op.numArgs === 2)
                    return op.apply2(argumentValues[0], argumentValues[1])
                } 
            }
        }

        if(this.scope.hasStored(funcText)){
            let funcObj = this.scope.getStored(funcText)
            if(typeof funcObj == 'function'){ 
                let compiler = new InliningCompiler(this.scope,this.irBuilder,funcText)
                let result = compiler.runInlining(argumentValues, funcObj)
                if(result){
                    return result
                }
                return
            }
        }

        if(node.expression.kind === ts.SyntaxKind.PropertyAccessExpression){
            let access = node.expression as ts.PropertyAccessExpression
            let obj = access.expression
            let prop = access.name
            let illegal_names = ["taichi", "ti", "Math"]
            for(let name of illegal_names){
                if(name === obj.getText()){
                    this.errorNode(node, "unresolved function: "+funcText)
                }
            }
            let propText = prop.getText()
            if(builtinOps.has(propText)){
                let op = builtinOps.get(propText)!
                if(op.numArgs === 1 && argumentValues.length === 0){ // write x.norm() and norm(x) are both ok
                    let objValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(obj)))
                    return op.apply1(objValue)
                }
                if(op.numArgs === 2 && argumentValues.length === 1){ // write x.dot(y) and dot(x,y) are both ok
                    let objValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(obj)))
                    return op.apply2(objValue, argumentValues[0])
                }
                else{
                    this.errorNode(node, "invalid function call: "+node.getText())
                }
            }

        }

        this.errorNode(node, "unresolved function: "+funcText)
    }

    protected override visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
        let base = node.expression
        let argument = node.argumentExpression
        if(base.kind === ts.SyntaxKind.Identifier){
            let baseName = base.getText()
            if(this.scope.hasStored(baseName) && this.typeChecker!.getSymbolAtLocation(base) === undefined){
                let hostSideValue:any = this.scope.getStored(baseName)
                if( hostSideValue instanceof Field){
                    let field = hostSideValue as Field

                    let resultType = field.elementType
                    let result = new Value(resultType)

                    let argumentValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(argument)))
                    this.assertNode(node, argumentValue.stmts.length === field.dimensions.length, "field access dimension mismatch ",argumentValue.stmts.length , field.dimensions.length)
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
        this.assertNode(node, !argumentValue.type.isMatrix(), "index cannot be a matrix")
        this.assertNode(node, !baseValue.type.isScalar, "cannot index a scalar")
        this.assertNode(node, argumentValue.isCompileTimeConstant(), "Indices of vectors/matrices must be a compile-time constant")

        let type = new Type( baseValue.type.primitiveType)
        let result = new Value(type)
        let indices = argumentValue.compileTimeConstants
        if(baseValue.type.isVector()){
            this.assertNode(node, indices.length === 1, "vector can only have 1 index")
            result.stmts.push(baseValue.stmts[indices[0]])
            if(baseValue.isCompileTimeConstant()){
                result.compileTimeConstants.push(baseValue.stmts[indices[0]])
            }
        }
        else if(baseValue.type.isMatrix()){
            this.assertNode(node, indices.length === 2, "matrix must have exactly 2 indices")
            let index = indices[0]*baseValue.type.numCols+indices[1]
            result.stmts.push(baseValue.stmts[index])
            if(baseValue.isCompileTimeConstant()){
                result.compileTimeConstants.push(baseValue.stmts[index])
            } 
        }

        return result
    }

    protected override visitPropertyAccessExpression(node: ts.PropertyAccessExpression): VisitorResult<Value> {
        let objExpr = node.expression
        let propExpr = node.name
        let propText = propExpr.getText()!
        if(objExpr.getText()==="Math"){
            if(propText === "PI"){
                return Value.makeConstantScalar(Math.PI,this.irBuilder.get_float32(Math.PI) ,PrimitiveType.f32)
            }
            if(propText === "E"){
                return Value.makeConstantScalar(Math.E,this.irBuilder.get_float32(Math.E) ,PrimitiveType.f32)
            }
            this.errorNode(node, "unrecognized Math constant: "+node.getText()+". Only Math.PI and Math.E are supported")
        }
        let objVal = this.evaluate(this.extractVisitorResult(this.dispatchVisit(objExpr)))
        // allow things like `let l = x.length`
        // is this needed?
        // let ops = this.getBuiltinOps()
        // if(ops.has(propText)){
        //     let op = ops.get(propText)!
        //     if(op.numArgs === 1){
        //         return op.apply1(objVal)
        //     } 
        // }
        let supportedComponents = new Map<string,number>()
        supportedComponents.set("x", 0)
        supportedComponents.set("y", 1)
        supportedComponents.set("z", 2)
        supportedComponents.set("w", 3)
        supportedComponents.set("r", 0)
        supportedComponents.set("g", 1)
        supportedComponents.set("b", 2)
        supportedComponents.set("a", 3)
        supportedComponents.set("u", 0)
        supportedComponents.set("v", 1)

        if(objVal.type.isVector()){
            if(propText.length === 1 && supportedComponents.has(propText)){
                let index = supportedComponents.get(propText)!
                let result = new Value(new Type(objVal.type.primitiveType),[objVal.stmts[index]])
                return result
            }
            if(propText.length > 1){
                let isValidSwizzle = true
                let indices:number[] = []
                for(let c of propText){
                    if(supportedComponents.has(c)){
                        indices.push(supportedComponents.get(c)!)
                    }
                    else{
                        isValidSwizzle = false
                        break;
                    }
                }
                if(isValidSwizzle){
                    let result = new Value(new Type(objVal.type.primitiveType,false,indices.length),[])
                    for(let i of indices){
                        result.stmts.push(objVal.stmts[i])
                    }
                    return result
                }
            }   
        } 
        this.errorNode(node, "invalid propertyAccess: "+node.getText())

    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if(symbol && this.symbolTable.has(symbol)){
            return this.symbolTable.get(symbol)
        }
        let name = node.getText()
        if(this.scope.hasStored(name)){
            let getValue = (val:any): Value|undefined => {
                let fail = () => {this.errorNode(node, "failed to evaluate "+name+" in kernel scope")}
                if(typeof val === "number"){
                    if(val % 1 === 0){
                        return Value.makeConstantScalar(val,this.irBuilder.get_int32(val),PrimitiveType.i32)
                    }
                    else{
                        return Value.makeConstantScalar(val,this.irBuilder.get_float32(val),PrimitiveType.f32)
                    }
                }
                if(Array.isArray(val)){
                    this.assertNode(node, val.length > 0, "cannot use empty array in kernel")
                    let result = getValue(val[0])
                    if(result === undefined){
                        fail()
                    }
                    if(val.length === 1){
                        result!.type.isScalar = false
                        return result
                    }
                    for(let i = 1; i<val.length;++i){
                        let thisValue = getValue(val[i])
                        if(thisValue === undefined){
                            fail()!
                        }
                        let maybeResult = this.comma(result!,thisValue!)
                        if(maybeResult === null){
                            this.errorNode(node, "Array element type mistach at "+node.getText())
                        }
                        else{
                            result = maybeResult
                        }
                    }
                    return result
                }
            }
            let val = this.scope.getStored(name)
            return getValue(val)
        }
        this.errorNode(node, "unresolved identifier: "+node.getText())
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value> {
        let identifier = node.name
        if(!node.initializer){
            this.errorNode(node, "variable declaration must have an identifier")
        }
        let illegal_names = ["taichi", "ti", "Math"]
        for(let name of illegal_names){
            if(name === node.name.getText()){
                this.errorNode(node, name + " cannot be used as a local variable name")
            }
        }
        // if(this.scope.hasStored(node.name.getText())){
        //     this.errorNode(node, node.name.getText() + " is already declared as a kernel-scope global variable")
        // }
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

    protected override visitIfStatement(node: ts.IfStatement): VisitorResult<Value> {
        let condValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        this.assertNode(node, condValue.type.isScalar, "condition of if statement must be scalar")
        let nativeIfStmt = this.irBuilder.create_if(condValue.stmts[0])
        let trueGuard = this.irBuilder.get_if_guard(nativeIfStmt,true)
        this.dispatchVisit(node.thenStatement)
        trueGuard.delete()
        if(node.elseStatement){
            let falseGuard = this.irBuilder.get_if_guard(nativeIfStmt,false)
            this.dispatchVisit(node.elseStatement)
            falseGuard.delete()
        }
    }

    protected override visitBreakStatement(node: ts.BreakStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0 && this.loopStack[this.loopStack.length-1] === LoopKind.While, "break can only be used in a while loop")
        this.irBuilder.create_break()
    }

    protected override visitContinueStatement(node: ts.ContinueStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0 , "continue must be used inside a loop")
        this.irBuilder.create_continue()
    }

    protected override visitWhileStatement(node: ts.WhileStatement): VisitorResult<Value> {
        let nativeWhileTrue = this.irBuilder.create_while_true()
        let guard = this.irBuilder.get_while_loop_guard(nativeWhileTrue)

        let condValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        this.assertNode(node, condValue.type.isScalar, "condition of while statement must be scalar")
        let breakCondition = this.irBuilder.create_logical_not(condValue.stmts[0])
        let nativeIfStmt = this.irBuilder.create_if(breakCondition)
        let trueGuard = this.irBuilder.get_if_guard(nativeIfStmt,true)
        this.irBuilder.create_break()
        trueGuard.delete()
        
        this.loopStack.push(LoopKind.While)
        this.dispatchVisit(node.statement)
        this.loopStack.pop()
        guard.delete()
    }

    protected visitRangeFor(indexSymbols:ts.Symbol[], rangeExpr:ts.NodeArray<ts.Expression>, body:ts.Statement) : VisitorResult<Value>{
        this.assertNode(null, rangeExpr.length === 1, "Expecting exactly 1 argument in range()")
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 loop index in range()")
        let rangeLengthExpr = rangeExpr[0]
        let rangeLengthValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(rangeLengthExpr)))
        this.assertNode(null, rangeLengthValue.type.primitiveType === PrimitiveType.i32 && rangeLengthValue.type.isScalar , "range must be i32 scalar")
        let zero = this.irBuilder.get_int32(0)
        let loop = this.irBuilder.create_range_for(zero, rangeLengthValue.stmts[0], 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let indexStmt = this.irBuilder.get_loop_index(loop,0);
        let indexValue = new Value(new Type(PrimitiveType.i32),[indexStmt])
        
        this.symbolTable.set(indexSymbols[0], indexValue)

        this.loopStack.push(LoopKind.For)

        this.dispatchVisit(body)

        this.loopStack.pop()

        loopGuard.delete()
    }

    protected visitNdrangeFor(indexSymbols:ts.Symbol[], rangeExpr:ts.NodeArray<ts.Expression>, body:ts.Statement) : VisitorResult<Value>{
        let numDimensions = rangeExpr.length
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 (grouped) loop index in ndrange()")
        this.assertNode(null, numDimensions > 0, "ndrange() arg list cannot be empty")
        let lengthValues: Value[] = []
        for(let lengthExpr of rangeExpr){
            let value = this.evaluate(this.extractVisitorResult(this.dispatchVisit(lengthExpr)))
            value = this.castTo(value,PrimitiveType.i32)
            this.assertNode(null, value.type.isScalar, "each arg to ndrange() must be a scalar")
            lengthValues.push(value)
        }
        let product = lengthValues[0].stmts[0]
        for(let i = 1;i < numDimensions ;++i){
            product  = this.irBuilder.create_mul(product, lengthValues[i].stmts[0])
        } 
        let zero = this.irBuilder.get_int32(0)
        let loop = this.irBuilder.create_range_for(zero, product, 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let flatIndexStmt = this.irBuilder.get_loop_index(loop,0);

        let indexValue = new Value(new Type(PrimitiveType.i32,false,numDimensions,1),[])
        let remainder = flatIndexStmt

        for(let i  = numDimensions-1; i>=0 ; --i){
            let thisDimStmt = lengthValues[i].stmts[0]
            let thisIndex = this.irBuilder.create_mod(remainder,thisDimStmt)
            indexValue.stmts = [thisIndex].concat(indexValue.stmts)
            remainder = this.irBuilder.create_floordiv(remainder,thisDimStmt)
        }
        
        this.symbolTable.set(indexSymbols[0], indexValue)

        this.loopStack.push(LoopKind.For)

        this.dispatchVisit(body)

        this.loopStack.pop()

        loopGuard.delete()
    }
    
    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<Value> {
        this.assertNode(node, node.initializer.kind === ts.SyntaxKind.VariableDeclarationList, "Expecting variable declaration list, got",node.initializer.kind)
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
            else if(calledFunctionText === "ndrange" || calledFunctionText === "ti.ndrange"){
                return this.visitNdrangeFor(loopIndexSymbols,callExpr.arguments, node.statement)
            }
            else{
                this.errorNode(node, "unsupported for-of initializer: ", calledFunctionText)
            }
        }
        else{
            this.errorNode(node, "range for not supported yet")
        }
    }
    protected override visitForInStatement(node: ts.ForInStatement): VisitorResult<Value> {
        this.errorNode(node, "Please use `for ... of ...` instead of  `for ... in ...`")
    }
}

export class InliningCompiler extends CompilingVisitor {
    constructor(scope: GlobalScope, irBuilder:NativeTaichiAny, public funcName:string){
        super(irBuilder, scope)
    }

    argValues:Value[] = []
    returnValue:Value|null = null
     
    runInlining(argValues:Value[], code: any): Value|null{
        this.argValues = argValues
        this.buildIR(code)
        return this.returnValue
    }

    protected override registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>){
        this.numArgs = args.length
        this.assertNode(null, this.numArgs === this.argValues.length,`ti.func ${this.funcName} called with incorrect amount of variables`)
        for(let i = 0;i<this.numArgs;++i){
            let val = this.argValues[i]
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol,val)
        }
    }

    protected override visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value> {
        if(this.returnValue){
            this.errorNode(node, "ti.func can only have at most one return statements")
        }
        if(node.expression){
            this.returnValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        }
    }
}
export class OneTimeCompiler extends CompilingVisitor {
    constructor(scope: GlobalScope){
        super(new nativeTaichi.IRBuilder(), scope)
    }
    compileKernel(code: any) : KernelParams {
        this.buildIR(code)

        if(!this.compilationResultName){
            this.compilationResultName = Program.getCurrentProgram().getAnonymousKernelName()
        }

        let kernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram,this.irBuilder , this.compilationResultName, false)
        for(let i = 0;i<this.numArgs;++i){
            kernel.insert_arg(toNativePrimitiveType(PrimitiveType.f32), false)
        }

        Program.getCurrentProgram().nativeAotBuilder.add(this.compilationResultName, kernel);

        let tasks = nativeTaichi.get_kernel_params(Program.getCurrentProgram().nativeAotBuilder,this.compilationResultName);
        let taskParams:TaskParams[] = []
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
            //console.log(wgsl)
            let bindings = getWgslShaderBindings(wgsl)
            //console.log(bindings)
            let rangeHint:string = task.get_range_hint()
            let workgroupSize = task.get_gpu_block_size()
            taskParams.push({
                code:wgsl,
                rangeHint,
                workgroupSize,
                bindings
            })
        }
        return new KernelParams(taskParams,this.numArgs)
    }
}