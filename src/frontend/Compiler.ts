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
        return result
    }
    static apply2<T>(left:Value, right:Value,allowBroadcastLeftToRight:boolean, allowBroadcastRightToLeft:boolean, 
                     datatypeTransform:DatatypeTransform,
                     f: (left :NativeTaichiAny, right :NativeTaichiAny) => T,
                     fConst: ((left:number, right:number) => number)|null = null
                     ):Value{
        let broadcastLeftToRight = false
        let broadcastRightToLeft = false
        if(left.type.isScalar && !right.type.isScalar){
            assert(allowBroadcastLeftToRight, "broadcast left to right not allowed")
            broadcastLeftToRight = true     
        }
        if(!left.type.isScalar && right.type.isScalar){
            assert(allowBroadcastRightToLeft, "broadcast right to left not allowed") 
            broadcastRightToLeft = true      
        }
        if(!left.type.isScalar && !right.type.isScalar){
            assert(left.type.numRows === right.type.numRows && left.type.numCols === right.type.numCols, 
                "matrix shape mismatch ",left.type, right.type) 
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
        return result
    }
}


enum LoopKind {
    For, While
}

class BuiltinOp {
    name:string = ""
    numArgs:number = 1
    irBuilderFunc:  (() => NativeTaichiAny) |
                    ((stmt:NativeTaichiAny) => NativeTaichiAny) | 
                    ((l:NativeTaichiAny, r:NativeTaichiAny) => NativeTaichiAny) = (x:NativeTaichiAny)=>x
    transform:DatatypeTransform = DatatypeTransform.Unchanged
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
        this.typeChecker = this.tsProgram.getTypeChecker()
        
        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file, got ",sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement (function or arrow function)")
        if(statements[0].kind === ts.SyntaxKind.FunctionDeclaration){
            let kernelFunction = statements[0] as ts.FunctionDeclaration
            this.compilationResultName = kernelFunction.name!.text
            this.registerArguments(kernelFunction.parameters)
            this.visitEachChild(kernelFunction.body!)
        }
        else if(statements[0].kind === ts.SyntaxKind.ExpressionStatement && 
                (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction){
            let kernelFunction = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(kernelFunction.parameters)
            this.visitEachChild(kernelFunction.body)
        }
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
            error("symbol not found for ",node)
        }
        return symbol!
    } 

    protected evaluate(val:Value) : Value{
        assert(val.stmts.length > 0, "val is empty")
        let kind = getStmtKind(val.stmts[0])
        switch(kind){
            case StmtKind.GlobalPtrStmt: {
                return Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (ptr) => this.irBuilder.create_global_ptr_global_load(ptr))
            }
            case StmtKind.AllocaStmt: {
                return Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (ptr) => this.irBuilder.create_local_load(ptr))
            }
            default: {
                return val
            }
        }
    }

    protected comma(leftValue:Value, rightValue:Value):Value{
        //assert(leftValue.type.primitiveType === rightValue.type.primitiveType,"primitive type mismatch")
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

    protected castTo(val:Value, primType: PrimitiveType):Value{
        if(val.type.primitiveType === primType){
            return val
        }
        if(primType === PrimitiveType.f32){
            return Value.apply1ElementWise(val,DatatypeTransform.AlwaysF32,(x)=>this.irBuilder.create_cast(x, toNativePrimitiveType(PrimitiveType.f32)))
        }
        else{ //if(primType === PrimitiveType.i32){
            return Value.apply1ElementWise(val,DatatypeTransform.AlwaysI32,(x)=>this.irBuilder.create_cast(x, toNativePrimitiveType(PrimitiveType.i32)))
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

    protected override visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): VisitorResult<Value> {
        let val = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.operand)))
        switch(node.operator){
            case ts.SyntaxKind.PlusToken:{
                return val
            }
            case ts.SyntaxKind.MinusToken:{
                return Value.apply1ElementWise(val, DatatypeTransform.Unchanged,(stmt)=>this.irBuilder.create_neg(stmt),(x)=>-x)
            }
            case ts.SyntaxKind.ExclamationToken:{
                return Value.apply1ElementWise(val, DatatypeTransform.Unchanged,(stmt)=>this.irBuilder.create_logical_not(stmt))
            }
            case ts.SyntaxKind.TildeToken:{
                return Value.apply1ElementWise(val, DatatypeTransform.Unchanged, (stmt)=>this.irBuilder.create_not(stmt))
            }
            default:
                error("unsupported prefix unary operator:"+node.getText())
        }
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value> {
        //console.log(node.getText())
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let rightValue = this.evaluate(right)
        let op = node.operatorToken
        switch(op.kind){
            case (ts.SyntaxKind.EqualsToken): {
                let leftStmtKind = getStmtKind(left.stmts[0])
                switch(leftStmtKind){
                    case StmtKind.GlobalPtrStmt:{
                        Value.apply2(left,rightValue,false,true, DatatypeTransform.DontCare,(l, r) => this.irBuilder.create_global_ptr_global_store(l,r))
                        return right
                    }
                    case StmtKind.AllocaStmt:{
                        Value.apply2(left,rightValue,false,true,DatatypeTransform.DontCare,(l, r) => this.irBuilder.create_local_store(l,r))
                        return right
                    }
                    default:{
                        error("Invalid assignment ",leftStmtKind)
                    }
                }
            }
            case (ts.SyntaxKind.PlusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_add(l,r), (l,r)=>l+r)
            }
            case (ts.SyntaxKind.MinusToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_sub(l,r), (l,r)=>l-r)
            }
            case (ts.SyntaxKind.AsteriskToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_mul(l,r), (l,r)=>l*r)
            }
            case (ts.SyntaxKind.SlashToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysF32, (l, r) => this.irBuilder.create_truediv(l,r), (l,r)=>l/r)
            }
            case (ts.SyntaxKind.AsteriskAsteriskToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_pow(l,r))
            }
            case (ts.SyntaxKind.PercentToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.PromoteToMatch, (l, r) => this.irBuilder.create_mod(l,r))
            }
            case (ts.SyntaxKind.LessThanToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_lt(l,r))
            }
            case (ts.SyntaxKind.LessThanEqualsToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_le(l,r))
            }
            case (ts.SyntaxKind.GreaterThanToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_gt(l,r))
            }
            case (ts.SyntaxKind.GreaterThanEqualsToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_ge(l,r))
            }
            case (ts.SyntaxKind.EqualsEqualsEqualsToken):
            case (ts.SyntaxKind.EqualsEqualsToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_eq(l,r))
            }
            case (ts.SyntaxKind.ExclamationEqualsEqualsToken):
            case (ts.SyntaxKind.ExclamationEqualsToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_cmp_ne(l,r))
            }
            case (ts.SyntaxKind.AmpersandToken):
            case (ts.SyntaxKind.AmpersandAmpersandToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_and(l,r))
            }
            case (ts.SyntaxKind.BarToken):
            case (ts.SyntaxKind.BarBarToken): {
                let leftValue = this.evaluate(left)
                return Value.apply2(leftValue, rightValue,true,true,DatatypeTransform.AlwaysI32, (l, r) => this.irBuilder.create_or(l,r))
            }
            case (ts.SyntaxKind.CommaToken): {
                let leftValue = this.evaluate(left)
                return this.comma(leftValue,rightValue)
            }
            default:
                error("Unrecognized binary operator "+op.getText())
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

    protected getBuiltinOps():BuiltinOp[]{
        let builtinOps:BuiltinOp[] = [ // firstly, we have CHI IR built-ins
            {name:"random",numArgs:0, irBuilderFunc:()=>this.irBuilder.create_rand(toNativePrimitiveType(PrimitiveType.f32)), transform:DatatypeTransform.AlwaysF32}, // doesn't work because of race-condition in spirv :))
            {name:"sin",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_sin(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"cos",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_cos(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"asin",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_asin(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"acos",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_acos(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"tan",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_tan(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"tanh",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_tanh(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"exp",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_exp(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"log",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_log(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"neg",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_neg(stmt),transform: DatatypeTransform.Unchanged  },
            {name:"not",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_not(stmt), transform:DatatypeTransform.AlwaysI32},
            {name:"logical_not",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.logical_not(stmt), transform:DatatypeTransform.AlwaysI32},
            {name:"abs",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_abs(stmt),transform: DatatypeTransform.Unchanged  },
            {name:"floor",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_floor(stmt), transform:DatatypeTransform.AlwaysI32},
            {name:"sgn",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_sgn(stmt), transform:DatatypeTransform.AlwaysI32}, 
            {name:"sqrt",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_sqrt(stmt), transform:DatatypeTransform.AlwaysF32},
            {name:"i32",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.i32)), transform:DatatypeTransform.AlwaysI32},
            {name:"f32",numArgs:1, irBuilderFunc:(stmt:NativeTaichiAny)=>this.irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.f32)), transform:DatatypeTransform.AlwaysF32},
            {name:"max",numArgs:2, irBuilderFunc:(l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_max(l,r) ,transform: DatatypeTransform.PromoteToMatch},
            {name:"min",numArgs:2, irBuilderFunc:(l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_min(l,r),transform: DatatypeTransform.PromoteToMatch},
            {name:"pow",numArgs:2, irBuilderFunc:(l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_pow(l,r),transform: DatatypeTransform.PromoteToMatch},
            {name:"atan2",numArgs:2, irBuilderFunc:(l:NativeTaichiAny,r:NativeTaichiAny)=>this.irBuilder.create_atan2(l,r), transform:DatatypeTransform.AlwaysF32},
        ]
        return builtinOps
    }

    protected override visitCallExpression(node: ts.CallExpression): VisitorResult<Value> {
        let funcText = node.expression.getText()
        let argumentValues:Value[] = []
        for(let arg of node.arguments){
            argumentValues.push(this.evaluate(this.extractVisitorResult(this.dispatchVisit(arg))))
        }
        let checkNumArgs = (n:number)=>{
            assert(argumentValues.length === n, funcText+" requires "+n.toString()+" args")
        }
        
        let builtinOps:BuiltinOp[] = this.getBuiltinOps()
        for(let op of builtinOps){
            if(funcText === op.name || funcText === "ti."+op.name || funcText === "Math."+op.name ){
                checkNumArgs(op.numArgs)
                let result:Value
                if(op.numArgs === 0){
                    let primType = PrimitiveType.f32
                    if(op.transform === DatatypeTransform.AlwaysF32){
                    }
                    else if(op.transform === DatatypeTransform.AlwaysI32){
                        primType = PrimitiveType.i32
                    }
                    else{
                        error("only allows AlwaysI32 or AlwaysF32 for 0-arg ops")
                    }
                    result = new Value(new Type(primType))
                    let func = op.irBuilderFunc as () => NativeTaichiAny
                    result.stmts.push(func())
                }
                else if(op.numArgs === 1){
                    result = Value.apply1ElementWise(argumentValues[0],op.transform, op.irBuilderFunc as (stmt:NativeTaichiAny) => NativeTaichiAny)
                }
                else{// if(op.numArgs === 2)
                    result = Value.apply2(argumentValues[0],argumentValues[1],true,true,op.transform,op.irBuilderFunc as (l:NativeTaichiAny, r:NativeTaichiAny) => NativeTaichiAny)
                }
                return result
            }
        }

        if(this.scope.hasStored(funcText)){
            let funcObj = this.scope.getStored(funcText)
            if(typeof funcObj == 'function'){ 
                let compiler = new InliningCompiler(this.scope,this.irBuilder)
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
                    error("unresolved function: "+funcText)
                }
            }
            let propText = prop.getText()

            let objValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(obj)))

        }

        error("unresolved function: "+funcText)
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
            assert(indices.length === 2, "matrix must have exactly 2 indices")
            let index = indices[0]*baseValue.type.numCols+indices[1]
            result.stmts.push(baseValue.stmts[index])
            if(baseValue.isCompileTimeConstant()){
                result.compileTimeConstants.push(baseValue.stmts[index])
            } 
        }

        return result
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if(symbol && this.symbolTable.has(symbol)){
            return this.symbolTable.get(symbol)
        }
        let name = node.getText()
        if(this.scope.hasStored(name)){
            let getValue = (val:any): Value|undefined => {
                let fail = () => {error("failed to evaluate "+name+" in kernel scope")}
                if(typeof val === "number"){
                    if(val % 1 === 0){
                        return Value.makeConstantScalar(val,this.irBuilder.get_int32(val),PrimitiveType.i32)
                    }
                    else{
                        return Value.makeConstantScalar(val,this.irBuilder.get_float32(val),PrimitiveType.f32)
                    }
                }
                if(Array.isArray(val)){
                    assert(val.length > 0, "cannot use empty array in kernel")
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
                        result = this.comma(result!,thisValue!)
                    }
                    return result
                }
            }
            let val = this.scope.getStored(name)
            return getValue(val)
        }
        error("unresolved identifier: "+node.getText())
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value> {
        let identifier = node.name
        if(!node.initializer){
            error("variable declaration must have an identifier")
        }
        let illegal_names = ["taichi", "ti", "Math"]
        for(let name of illegal_names){
            if(name === node.name.getText()){
                error(name + " cannot be used as a local variable name")
            }
        }
        // if(this.scope.hasStored(node.name.getText())){
        //     error(node.name.getText() + " is already declared as a kernel-scope global variable")
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
        assert(condValue.type.isScalar, "condition of if statement must be scalar")
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
        assert(this.loopStack.length > 0 && this.loopStack[this.loopStack.length-1] === LoopKind.While, "break can only be used in a while loop")
        this.irBuilder.create_break()
    }

    protected override visitContinueStatement(node: ts.ContinueStatement): VisitorResult<Value> {
        assert(this.loopStack.length > 0 , "continue must be used inside a loop")
        this.irBuilder.create_continue()
    }

    protected override visitWhileStatement(node: ts.WhileStatement): VisitorResult<Value> {
        let nativeWhileTrue = this.irBuilder.create_while_true()
        let guard = this.irBuilder.get_while_loop_guard(nativeWhileTrue)

        let condValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        assert(condValue.type.isScalar, "condition of while statement must be scalar")
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
        assert(rangeExpr.length === 1, "Expecting exactly 1 argument in range()")
        assert(indexSymbols.length === 1, "Expecting exactly 1 loop index in range()")
        let rangeLengthExpr = rangeExpr[0]
        let rangeLengthValue = this.evaluate(this.extractVisitorResult(this.dispatchVisit(rangeLengthExpr)))
        assert(rangeLengthValue.type.primitiveType === PrimitiveType.i32 && rangeLengthValue.type.isScalar , "range must be i32 scalar")
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
        assert(indexSymbols.length === 1, "Expecting exactly 1 (grouped) loop index in ndrange()")
        assert(numDimensions > 0, "ndrange() arg list cannot be empty")
        let lengthValues: Value[] = []
        for(let lengthExpr of rangeExpr){
            let value = this.evaluate(this.extractVisitorResult(this.dispatchVisit(lengthExpr)))
            value = this.castTo(value,PrimitiveType.i32)
            //assert(value.type.primitiveType === PrimitiveType.i32 && value.type.isScalar, "each arg to ndrange() must be i32 scalar")
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
            else if(calledFunctionText === "ndrange" || calledFunctionText === "ti.ndrange"){
                return this.visitNdrangeFor(loopIndexSymbols,callExpr.arguments, node.statement)
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

export class InliningCompiler extends CompilingVisitor {
    constructor(scope: GlobalScope, irBuilder:NativeTaichiAny){
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
        assert(this.numArgs === this.argValues.length,"ti.func called with incorrect amount of variables")
        for(let i = 0;i<this.numArgs;++i){
            let val = this.argValues[i]
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol,val)
        }
    }

    protected override visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value> {
        if(this.returnValue){
            error("ti.func can only have at most one return statements")
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