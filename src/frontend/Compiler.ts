import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import { ASTVisitor, VisitorResult } from "./ast/Visiter"
import { CompiledKernel, TaskParams, BufferBinding, BufferType, KernelParams, RenderPipelineParams, VertexShaderParams, FragmentShaderParams } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny } from '../native/taichi/GetTaichi'
import { error, assert } from '../utils/Logging'
import { Scope } from "../program/Scope";
import { CanvasTexture, Field, Texture, TextureBase } from "../program/Field";
import { Program } from "../program/Program";
import { getStmtKind, StmtKind } from "./Stmt"
import { getWgslShaderBindings, getWgslShaderStage, WgslShaderStage } from "./WgslReflection"
import { LibraryFunc } from "./Library";
import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, TypeUtils, PrimitiveType, toNativePrimitiveType, TypeError } from "./Type"
import { Value, ValueUtils } from "./Value"
import { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory } from "./BuiltinOp";
import { ResultOrError } from "./Error";


export class ParsedFunction {
    constructor(code: string) {
        let host: InMemoryHost = new InMemoryHost()
        let tempFileName = "temp.js"
        host.writeFile(tempFileName, code)
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
        this.tsProgram = ts.createProgram([tempFileName], tsOptions, host);
        this.errorTsDiagnostics(this.tsProgram.getSyntacticDiagnostics())
        this.typeChecker = this.tsProgram.getTypeChecker()

        let sourceFiles = this.tsProgram!.getSourceFiles()
        this.assertNode(sourceFiles[0], sourceFiles.length === 1, "Expecting exactly 1 source file, got ", sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        this.assertNode(sourceFiles[0], statements.length === 1, "Expecting exactly 1 statement in ti.kernel (A single function or arrow function)")
        if (statements[0].kind === ts.SyntaxKind.FunctionDeclaration) {
            let func = statements[0] as ts.FunctionDeclaration
            this.registerArguments(func.parameters)
        }
        else if (statements[0].kind === ts.SyntaxKind.ExpressionStatement &&
            (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction) {
            let func = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(func.parameters)
        }
        else {
            this.errorNode(sourceFiles[0], "Expecting a function or an arrow function in ti.kernel")
        }
    }

    typeChecker: ts.TypeChecker
    tsProgram: ts.Program
    argNames: string[] = []
    argNodes: ts.ParameterDeclaration[] = []

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        for (let a of args) {
            this.argNames.push(a.name.getText())
            this.argNodes.push(a)
        }
    }

    hasNodeSymbol(node: ts.Node): boolean {
        return this.typeChecker.getSymbolAtLocation(node) !== undefined
    }

    getNodeSymbol(node: ts.Node): ts.Symbol {
        let symbol = this.typeChecker.getSymbolAtLocation(node)
        if (symbol === undefined) {
            this.errorNode(node, "symbol not found for " + node.getText())
        }
        return symbol!
    }

    getSourceCodeAt(startPos: number, endPos: number): string {
        let sourceFile = this.tsProgram!.getSourceFiles()[0]
        let startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line
        let endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line

        let start = sourceFile.getLineStarts()[startLine]
        let end = sourceFile.getLineStarts()[endLine + 1]
        let code = sourceFile.getText().slice(start, end)
        return code
    }

    errorTsDiagnostics(diags: readonly ts.DiagnosticWithLocation[]) {
        let message = ""
        for (let diag of diags) {
            if (diag.category === ts.DiagnosticCategory.Error) {
                let startPos = diag.start
                let endPos = diag.start + diag.length
                let code = this.getSourceCodeAt(startPos, endPos)
                message += `
                Syntax Error: ${diag.messageText}   
                at:  
                ${code}
                `
            }
        }
        if (message !== "") {
            error("Kernel/function code cannot be parsed as Javascript: \n" + message)
        }
    }

    errorNode(node: ts.Node, ...args: any[]) {

        let startPos = node.getStart()
        let endPos = node.getEnd()
        let code = this.getSourceCodeAt(startPos, endPos)
        let errorMessage = "Error: "
        for (let a of args) {
            errorMessage += String(a)
        }
        errorMessage += `\nat:\n ${code} `
        error(errorMessage)
    }

    assertNode(node: ts.Node, condition: boolean, ...args: any[]) {
        if (!condition) {
            this.errorNode(node, ...args)
        }
    }
}


enum LoopKind {
    For, While, StaticFor, VertexFor, FragmentFor
}

class CompilingVisitor extends ASTVisitor<Value>{
    constructor(
        protected irBuilder: NativeTaichiAny,
        protected builtinOps: Map<string, BuiltinOp>,
        protected atomicOps: Map<string, BuiltinAtomicOp>,
    ) {
        super()

    }

    protected kernelScope: Scope = new Scope()
    protected templatedValues: Scope = new Scope()
    protected symbolTable: Map<ts.Symbol, Value> = new Map<ts.Symbol, Value>()
    protected parsedFunction: ParsedFunction | null = null

    public compilationResultName: string | null = null

    public returnValue: Value | null = null

    protected loopStack: LoopKind[] = []
    protected branchDepth: number = 0

    protected lastVisitedNode: ts.Node | null = null

    // vert/frag shader compilation state
    protected startedVertex = false
    protected finishedVertex = false
    protected startedFragment = false

    protected renderPipelineParams: RenderPipelineParams[] = []
    protected currentRenderPipelineParams: RenderPipelineParams | null = null

    buildIR(parsedFunction: ParsedFunction, kernelScope: Scope, templatedValues: Scope) {
        this.kernelScope = kernelScope
        this.templatedValues = templatedValues
        this.parsedFunction = parsedFunction
        this.symbolTable = new Map<ts.Symbol, Value>()

        let sourceFiles = this.parsedFunction!.tsProgram.getSourceFiles()
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        if (statements[0].kind === ts.SyntaxKind.FunctionDeclaration) {
            let func = statements[0] as ts.FunctionDeclaration
            this.compilationResultName = func.name!.text
            this.registerArguments(func.parameters)
            this.visitInputFunctionBody(func.body!)
        }
        else if (statements[0].kind === ts.SyntaxKind.ExpressionStatement &&
            (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction) {
            let func = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(func.parameters)
            let body = func.body
            if (body.kind === ts.SyntaxKind.Block) {
                this.visitInputFunctionBody(body)
            }
            else {
                // then this is an immediately-returning function, e.g. (x,y) => x+y
                let returnStmt = ts.factory.createReturnStatement(func.body as ts.Expression)
                this.visitReturnStatement(returnStmt)
            }
        }
    }

    protected visitInputFunctionBody(body: ts.Block | ts.ConciseBody) {
        this.visitEachChild(body)
    }

    protected override dispatchVisit(node: ts.Node): VisitorResult<Value> {
        if (this.returnValue) {
            this.errorNode(node, "If there is a `return`, it must be the final statement of the function")
        }
        if (this.finishedVertex && !this.startedFragment) {
            if (!this.isFragmentFor(node)) {
                this.errorNode(node, "No statements allowed between the vertex shader and the fragment shader")
            }
        }
        this.lastVisitedNode = node
        return super.dispatchVisit(node)
    }

    protected override extractVisitorResult(result: VisitorResult<Value>): Value {
        this.assertNode(null, result !== undefined, "VistorResult is undefined")
        return super.extractVisitorResult(result)
    }

    protected extractValueOrError(valueOrError: ResultOrError<Value>, node: ts.Node | null, ...args: any): Value {
        if (valueOrError.isError) {
            this.errorNode(node, valueOrError.errorMessage, ...args)
        }
        return valueOrError.result!
    }

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        this.errorNode(args[0], "[Compiler bug] should call overriden function")
    }

    protected hasNodeSymbol(node: ts.Node): boolean {
        return this.parsedFunction!.hasNodeSymbol(node)
    }

    protected getNodeSymbol(node: ts.Node): ts.Symbol {
        return this.parsedFunction!.getNodeSymbol(node)
    }

    // node: an identifier or property access epxreesion
    // returns a JS value if the expr can be evaluated in kernel scope (i.e. the scope created by ti.addToKernelScope) or in template args
    protected tryEvalInKernelScopeOrTemplateArgs( node:ts.Node ) : any{
        let exprText = node.getText()
        while(node.kind === ts.SyntaxKind.PropertyAccessExpression){
            let access = node as ts.PropertyAccessExpression
            node = access.expression
        } 
        if(this.hasNodeSymbol(node)){
            // ts has created a symbol for this node. 
            // This means the expr isn't "free", in the sense of https://en.wikipedia.org/wiki/Free_variables_and_bound_variables
            // As a result, it mustn't be treated as a kernel scope expr. 
            let symbol = this.getNodeSymbol(node)
            let foundInArgs = false
            for(let argNode of this.parsedFunction!.argNodes){
                if (this.getNodeSymbol(argNode.name) === symbol){
                    foundInArgs = true
                    break
                }
            }
            if(!foundInArgs){
                // the node corresponds to a non-argument node, so it is a local var
                return undefined
            }
            if(!this.templatedValues.canEvaluate(exprText)){
                // a non-template argument
                return undefined
            }
            return this.templatedValues.tryEvaluate(exprText)
        } 
        else{
            // "free" expr. 
            return this.kernelScope.tryEvaluate(exprText)
        }
    }

    protected canEvalInKernelScopeOrTemplateArgs( node:ts.Node ) : boolean {
        return this.tryEvalInKernelScopeOrTemplateArgs(node) !== undefined
    }


    protected errorNode(node: ts.Node | null, ...args: any[]) {
        if (node === null) {
            if (this.lastVisitedNode !== null) {
                this.errorNode(this.lastVisitedNode, ...args)
            }
            else {
                error(...args)
            }
            return
        }
        this.parsedFunction!.errorNode(node!, ...args);
    }

    protected assertNode(node: ts.Node | null, condition: boolean, ...args: any[]) {
        if (!condition) {
            this.errorNode(node, ...args)
        }
    }

    protected derefIfPointer(val: Value): Value {
        this.assertNode(null, val.stmts.length > 0, "value is empty")
        this.assertNode(null, val.stmts[0] !== undefined, "value is undefined")
        let type = val.getType()
        if (type.getCategory() !== TypeCategory.Pointer) {
            return val
        }
        let loadOp = this.builtinOps.get("load")!
        return loadOp.apply([val])
    }

    protected createLocalVarCopy(val: Value): Value {
        let valueType = val.getType()
        let primitiveTypes = valueType.getPrimitivesList()
        let varValue = new Value(new PointerType(valueType, false))
        for (let i = 0; i < primitiveTypes.length; ++i) {
            let alloca = this.irBuilder.create_local_var(toNativePrimitiveType(primitiveTypes[i]))
            varValue.stmts.push(alloca)
            this.irBuilder.create_local_store(alloca, val.stmts[i])
        }
        return varValue
    }

    protected comma(leftValue: Value, rightValue: Value): Value {
        let leftType = leftValue.getType()
        let rightType = rightValue.getType()
        if (!TypeUtils.isTensorType(leftType) || !TypeUtils.isTensorType(rightType)) {
            this.errorNode(null, "Only scalar/vector/matrix types can be grouped together")
        }
        let leftPrim = TypeUtils.getPrimitiveType(leftType)
        let rightPrim = TypeUtils.getPrimitiveType(rightType)
        let hasFloat = leftPrim === PrimitiveType.f32 || rightPrim === PrimitiveType.f32
        if (hasFloat) {
            leftValue = this.castTo(leftValue, PrimitiveType.f32)
            rightValue = this.castTo(rightValue, PrimitiveType.f32)
        }
        let leftCat = leftType.getCategory()
        let rightCat = rightType.getCategory()
        if (leftCat === TypeCategory.Scalar && rightCat === TypeCategory.Scalar) {
            return ValueUtils.makeVectorFromScalars([leftValue, rightValue])
        }
        if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Scalar) {
            return ValueUtils.addScalarToVector(leftValue, rightValue)
        }
        if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Vector) {
            let vec0 = leftType as VectorType
            let vec1 = rightType as VectorType
            this.assertNode(null, vec0.getNumRows() === vec1.getNumRows(), "vector numRows mismatch")
            return ValueUtils.makeMatrixFromVectorsAsRows([leftValue, rightValue])
        }
        if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Vector) {
            let mat0 = leftType as MatrixType
            let vec1 = rightType as VectorType
            this.assertNode(null, mat0.getNumCols() === vec1.getNumRows(), "vector numRows mismatch")
            return ValueUtils.addRowVectorToMatrix(leftValue, rightValue)
        }
        this.errorNode(null, "Invalid comma grouping")

        return leftValue
    }

    protected castTo(val: Value, primType: PrimitiveType): Value {
        let type = val.getType()
        this.assertNode(null, TypeUtils.isTensorType(type), "[Compiler Bug] castTo called on non-tensor types")
        let originalPrim = TypeUtils.getPrimitiveType(type)
        if (originalPrim === primType) {
            return val
        }
        if (primType === PrimitiveType.f32) {
            return this.builtinOps.get("f32")!.apply([val])
        }
        else { //if(primType === PrimitiveType.i32){
            return this.builtinOps.get("i32")!.apply([val])
        }
    }


    protected override visitNumericLiteral(node: ts.NumericLiteral): VisitorResult<Value> {
        let value = Number(node.getText())
        if (node.getText().includes(".") || node.getText().includes("e")) {
            return ValueUtils.makeConstantScalar(value, this.irBuilder.get_float32(value), PrimitiveType.f32)
        }
        else {
            return ValueUtils.makeConstantScalar(value, this.irBuilder.get_int32(value), PrimitiveType.i32)
        }
    }


    protected override visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): VisitorResult<Value> {
        let val = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.operand)))
        let op: BuiltinOp | null = null
        switch (node.operator) {
            case ts.SyntaxKind.PlusToken: {
                return val
            }
            case ts.SyntaxKind.MinusToken: {
                op = this.builtinOps.get("neg")!
                break;
            }
            case ts.SyntaxKind.ExclamationToken: {
                op = this.builtinOps.get("logical_not")!
                break;
            }
            case ts.SyntaxKind.TildeToken: {
                op = this.builtinOps.get("not")!
                break;
            }
            default:
                this.errorNode(node, "unsupported prefix unary operator:" + node.getText())
        }
        let typeError = op!.checkType([val])
        if (typeError.hasError) {
            this.errorNode(node, "type error in unary operator:" + node.getText() + "  " + typeError.msg)
        }
        return op!.apply([val])
    }


    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value> {
        //console.log(node.getText())
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let leftType = left.getType()
        let rightValue = this.derefIfPointer(right)
        let opToken = node.operatorToken
        if (opToken.kind === ts.SyntaxKind.EqualsToken) {
            if (leftType.getCategory() != TypeCategory.Pointer) {
                this.errorNode(node, "Left hand side of assignment must be an l-value. ", leftType.getCategory())
            }
            let storeOp = this.builtinOps.get("=")!
            let typeError = storeOp.checkType([left, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, "Assignment type error: " + typeError.msg)
            }
            storeOp.apply([left, rightValue])
            return
        }

        let atomicOps = this.atomicOps
        let tokenToOp = new Map<ts.SyntaxKind, BuiltinOp>()
        tokenToOp.set(ts.SyntaxKind.PlusEqualsToken, atomicOps.get("atomic_add")!);
        tokenToOp.set(ts.SyntaxKind.MinusEqualsToken, atomicOps.get("atomic_sub")!);
        tokenToOp.set(ts.SyntaxKind.AmpersandEqualsToken, atomicOps.get("atomic_and")!);
        tokenToOp.set(ts.SyntaxKind.BarEqualsToken, atomicOps.get("atomic_or")!);
        if (tokenToOp.has(opToken.kind)) {
            let atomicOp = tokenToOp.get(opToken.kind)!
            let typeError = atomicOp.checkType([left, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, "Atomic type error: " + typeError.msg)
            }
            return atomicOp.apply([left, rightValue])
        }

        let leftValue = this.derefIfPointer(left)
        let opTokenText = opToken.getText()
        let builtinOps = this.builtinOps
        if (builtinOps.has(opTokenText)) {
            let op = builtinOps.get(opTokenText)!
            let typeError = op.checkType([leftValue, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, `Binary op ${opTokenText} type error: ` + typeError.msg)
            }
            return op.apply([leftValue, rightValue])
        }

        if (opToken.kind === ts.SyntaxKind.CommaToken) {
            return this.comma(leftValue, rightValue)
        }

        this.errorNode(node, "unsupported binary operator:" + opTokenText)
    }

    protected override visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): VisitorResult<Value> {
        let elements = node.elements
        this.assertNode(node, elements.length > 0, "cannot have empty arrays")
        let elementValues: Value[] = []
        for (let el of elements) {
            elementValues.push(this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(el))))
        }
        if (elementValues.length === 1) {
            let cat = elementValues[0].getType().getCategory()
            if (cat === TypeCategory.Scalar) {
                return ValueUtils.makeVectorFromScalars(elementValues)
            }
            else if (cat === TypeCategory.Vector) {
                return ValueUtils.makeMatrixFromVectorsAsRows(elementValues)
            }
            else {
                this.errorNode(node, "array expression can only be used to represent vectors and matrices")
            }
        }
        let result = elementValues[0]
        for (let i = 1; i < elements.length; ++i) {
            result = this.comma(result, elementValues[i])
        }
        return result
    }

    protected override visitObjectLiteralExpression(node: ts.ObjectLiteralExpression): VisitorResult<Value> {
        let keys: string[] = []
        let memberValues = new Map<string, Value>()
        let memberTypes: any = {}
        for (let prop of node.properties) {
            if (prop.kind !== ts.SyntaxKind.PropertyAssignment) {
                this.errorNode(prop, "expecting property assignment")
            }
            let propAssign = prop as ts.PropertyAssignment
            let name = propAssign.name.getText()
            keys.push(name)
            let val = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(propAssign.initializer)))
            memberValues.set(name, val)
            memberTypes[name] = val.getType()
        }
        let structValue = ValueUtils.makeStruct(keys, memberValues)
        return structValue
    }

    protected override visitParenthesizedExpression(node: ts.ParenthesizedExpression): VisitorResult<Value> {
        return this.extractVisitorResult(this.dispatchVisit(node.expression))
    }

    protected override visitCallExpression(node: ts.CallExpression): VisitorResult<Value> {
        let funcText = node.expression.getText()

        let checkNumArgs = (n: number) => {
            this.assertNode(node, node.arguments.length === n, funcText + " requires " + n.toString() + " args")
        }


        let argumentRefs: Value[] | null = null  // pointer for l-values, newly created alloca copies for r-values
        let getArgumentRefs = (): Value[] => {
            if (argumentRefs !== null) {
                return argumentRefs
            }
            argumentRefs = []
            for (let arg of node.arguments) {
                let argVal = this.extractVisitorResult(this.dispatchVisit(arg))
                if (argVal.getType().getCategory() === TypeCategory.Pointer) {
                    argumentRefs.push(argVal)
                }
                else {
                    // passing r value. Create a local var copy, so that it can be assigned in the func
                    let copy = this.createLocalVarCopy(argVal)
                    argumentRefs.push(copy)
                }
            }
            return argumentRefs
        }

        let argumentValues: Value[] | null = null
        let getArgumentValues = (): Value[] => {
            if (argumentValues !== null) {
                return argumentValues
            }
            argumentValues = []
            for (let ref of getArgumentRefs()) {
                argumentValues.push(this.derefIfPointer(ref))
            }
            return argumentValues
        }


        // function semantics: pass by ref for l-values, pass by value for r-values

        // user defined funcs
        if (this.canEvalInKernelScopeOrTemplateArgs(node.expression)) {
            let funcObj = this.tryEvalInKernelScopeOrTemplateArgs(node.expression)
            if (typeof funcObj == 'function') {
                let compiler = new InliningCompiler(this.irBuilder, this.builtinOps, this.atomicOps, funcText)
                let parsedInlinedFunction = new ParsedFunction(funcObj.toString())
                let result = compiler.runInlining(parsedInlinedFunction, this.kernelScope, getArgumentRefs())
                if (result) {
                    return result
                }
                return
            }
        }

        // Library funcs
        let libraryFuncs = LibraryFunc.getLibraryFuncs()
        for (let kv of libraryFuncs) {
            let func = kv[1]
            if (funcText === func.name || funcText === "ti." + func.name) {
                let compiler = new InliningCompiler(this.irBuilder, this.builtinOps, this.atomicOps, funcText)
                let parsedInlinedFunction = new ParsedFunction(func.code)
                let result = compiler.runInlining(parsedInlinedFunction, this.kernelScope, getArgumentRefs())
                if (result) {
                    return result
                }
                return
            }
        }

        // built-in funcs (mostly math stuff)
        let builtinOps = this.builtinOps
        for (let kv of builtinOps) {
            let op = kv[1]
            if (funcText === op.name || funcText === "ti." + op.name || funcText === "Math." + op.name) {
                checkNumArgs(op.arity)
                let typeError = op.checkType(getArgumentValues())
                if (typeError.hasError) {
                    this.errorNode(node, "Builtin op error: ", typeError.msg)
                }
                return op.apply(getArgumentValues())
            }
        }

        // atomic
        let atomicOps = this.atomicOps
        for (let kv of atomicOps) {
            let op = kv[1]
            if (funcText === op.name || funcText === "ti." + op.name) {
                checkNumArgs(2)
                let destPtr = getArgumentRefs()[0]
                let val = getArgumentValues()[1]
                let typeError = op.checkType([destPtr, val])
                if (typeError.hasError) {
                    this.errorNode(node, "Atomic type error: ", typeError.msg)
                }
                return op.apply([destPtr, val])
            }
        }

        if (funcText === "ti.output_vertex" || funcText === "output_vertex") {
            this.assertNode(node, getArgumentValues().length === 1, "output_vertex() must have exactly 1 argument")
            let vertexOutput = getArgumentValues()[0]
            this.assertNode(node, this.startedVertex && !this.finishedVertex, "output_vertex() can only be used inside a vertex-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")
            this.currentRenderPipelineParams!.interpolatedType = vertexOutput.getType()
            let prims = vertexOutput.getType().getPrimitivesList()
            for (let i = 0; i < prims.length; ++i) {
                this.irBuilder.create_vertex_output(i, vertexOutput.stmts[i])
            }
            return
        }

        if (funcText === "ti.output_position" || funcText === "output_position") {
            this.assertNode(node, getArgumentValues().length === 1, "output_position must have exactly 1 argument")
            let posOutput = getArgumentValues()[0]
            this.assertNode(node, this.startedVertex && !this.finishedVertex, "output_position() can only be used inside a vertex-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")

            this.assertNode(node, posOutput.getType().getCategory() === TypeCategory.Vector, "position output must be a vector")
            let outputVecType = posOutput.getType() as VectorType
            this.assertNode(node, outputVecType.getNumRows() === 4, "position output must be a 4D vector")

            let stmtsVec: NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()

            for (let i = 0; i < posOutput.stmts.length; ++i) {
                stmtsVec.push_back(posOutput.stmts[i])
            }

            this.irBuilder.create_position_output(stmtsVec)
            return
        }

        if (funcText === "ti.output_color" || funcText === "output_color") {
            this.assertNode(node, this.startedFragment, "output_color() can only be used inside a fragment-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")

            this.assertNode(node, node.arguments.length === 2, "output_color() must have exactly 2 arguments, one for output texture, the other for the output value")
            this.assertNode(node, this.canEvalInKernelScopeOrTemplateArgs(node.arguments[0]), "the first argument of output_color() must be a texture object that's visible in kernel scope")
            let renderTarget = this.tryEvalInKernelScopeOrTemplateArgs(node.arguments[0])
            this.assertNode(node, renderTarget instanceof Texture || renderTarget instanceof CanvasTexture, "the first argument of output_color() must be a texture object that's visible in kernel scope")
            let targetTexture = renderTarget as TextureBase
            let targetLocation = -1
            let existingTargets = this.currentRenderPipelineParams!.fragment.outputTexutres
            for (let i = 0; i < existingTargets.length; ++i) {
                if (existingTargets[i].textureId === targetTexture.textureId) {
                    targetLocation = i
                    break
                }
            }
            if (targetLocation === -1) {
                // a new target
                targetLocation = existingTargets.length
                existingTargets.push(targetTexture)
            }

            let fragOutput = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.arguments[1])))
            this.assertNode(node, fragOutput.getType().getCategory() === TypeCategory.Vector, "frag output must be a vector")
            let outputVecType = fragOutput.getType() as VectorType
            this.assertNode(node, outputVecType.getNumRows() === 1 || outputVecType.getNumRows() === 2 || outputVecType.getNumRows() === 4, "output vector component count must be 1, 2, or 4")

            let stmtsVec: NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()

            for (let i = 0; i < fragOutput.stmts.length; ++i) {
                stmtsVec.push_back(fragOutput.stmts[i])
            }

            this.irBuilder.create_color_output(targetLocation, stmtsVec)
            return
        }

        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let access = node.expression as ts.PropertyAccessExpression
            let obj = access.expression
            let prop = access.name
            let illegal_names = ["taichi", "ti", "Math"]
            for (let name of illegal_names) {
                if (name === obj.getText()) {
                    this.errorNode(node, "unresolved function: " + funcText)
                }
            }
            let propText = prop.getText()
            // writing x.norm() and norm(x) are both ok
            // writing x.dot(y) and dot(x,y) are both ok
            if (builtinOps.has(propText)) {
                let op = builtinOps.get(propText)!
                let objValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(obj)))
                let allArgumentValues = [objValue].concat(getArgumentValues())
                let typeError = op.checkType(allArgumentValues)
                if (typeError.hasError) {
                    this.errorNode(node, "Builtin op error: ", typeError.msg)
                }
                return op.apply(allArgumentValues)
            }
        }

        this.errorNode(node, "unresolved function call: " + funcText)
    }

    protected override visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
        let base = node.expression
        let argument = node.argumentExpression
        if (base.kind === ts.SyntaxKind.Identifier) {
            let baseName = base.getText()
            // taichi global scope function added via `ti.addToKernelScope`, or template arguments
            if (this.canEvalInKernelScopeOrTemplateArgs(base)) {
                let hostSideValue: any = this.tryEvalInKernelScopeOrTemplateArgs(base)
                if (hostSideValue instanceof Field) {
                    let field = hostSideValue as Field

                    let result = new Value(new PointerType(field.elementType, true), [])

                    let argumentValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(argument)))
                    let argType = argumentValue.getType()
                    this.assertNode(node, argType.getCategory() === TypeCategory.Scalar || argType.getCategory() === TypeCategory.Vector, "index must be scalar or vector")

                    this.assertNode(node, argumentValue.stmts.length === field.dimensions.length, "field access dimension mismatch ", argumentValue.stmts.length, field.dimensions.length)
                    let accessVec: NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
                    for (let stmt of argumentValue.stmts) {
                        accessVec.push_back(stmt)
                    }

                    for (let place of field.placeNodes) {
                        let ptr = this.irBuilder.create_global_ptr(place, accessVec);
                        result.stmts.push(ptr)
                    }
                    return result
                }
            }
        }
        let baseValue = this.extractVisitorResult(this.dispatchVisit(base))
        let argumentValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(argument)))
        let baseType = baseValue.getType()
        let argType = argumentValue.getType()

        this.assertNode(node, argType.getCategory() === TypeCategory.Scalar || argType.getCategory() === TypeCategory.Vector, "index must be scalar or vector")
        this.assertNode(node, argumentValue.isCompileTimeConstant(), "Indices of vectors/matrices must be a compile-time constant")
        this.assertNode(node, TypeUtils.getPrimitiveType(argType) === PrimitiveType.i32, "Indices of be of i32 type")

        if (TypeUtils.isValueOrPointerOfCategory(baseType, TypeCategory.Vector)) {
            this.assertNode(node, argType.getCategory() === TypeCategory.Scalar, "index for a vector must be a scalar")
            let components = ValueUtils.getVectorComponents(baseValue)
            return components[argumentValue.compileTimeConstants[0]]
        }
        else if (TypeUtils.isValueOrPointerOfCategory(baseType, TypeCategory.Matrix)) {
            if (argType.getCategory() === TypeCategory.Vector) {
                let argVecType = argType as VectorType
                this.assertNode(node, argVecType.getNumRows() === 2, "a vector index of matrix must be a 2D vector")
                let components = ValueUtils.getMatrixComponents(baseValue)
                return components[argumentValue.compileTimeConstants[0]][argumentValue.compileTimeConstants[1]]
            }
            else if (argType.getCategory() === TypeCategory.Scalar) {
                let rows = ValueUtils.getMatrixRowVectors(baseValue)
                return rows[argumentValue.compileTimeConstants[0]]
            }
        }
        else {
            this.errorNode(node, "only vectors and matrices can be indexed")
        }
    }

    protected override visitPropertyAccessExpression(node: ts.PropertyAccessExpression): VisitorResult<Value> {
        let objExpr = node.expression
        let propExpr = node.name
        let propText = propExpr.getText()!
        if (objExpr.getText() === "Math") {
            if (propText === "PI") {
                return ValueUtils.makeConstantScalar(Math.PI, this.irBuilder.get_float32(Math.PI), PrimitiveType.f32)
            }
            if (propText === "E") {
                return ValueUtils.makeConstantScalar(Math.E, this.irBuilder.get_float32(Math.E), PrimitiveType.f32)
            }
            this.errorNode(node, "unrecognized Math constant: " + node.getText() + ". Only Math.PI and Math.E are supported")
        }
        let objRef = this.extractVisitorResult(this.dispatchVisit(objExpr))
        // allow things like `let l = x.length`
        // is this needed?
        // let ops = this.getBuiltinOps()
        // if(ops.has(propText)){
        //     let op = ops.get(propText)!
        //     if(op.numArgs === 1){
        //         return op.apply1(objVal)
        //     } 
        // }


        if (TypeUtils.isValueOrPointerOfCategory(objRef.getType(), TypeCategory.Vector)) {
            let supportedComponents = new Map<string, number>()
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

            let components = ValueUtils.getVectorComponents(objRef)
            if (propText.length === 1 && supportedComponents.has(propText)) {
                let index = supportedComponents.get(propText)!
                return components[index]
            }
            if (propText.length > 1) {
                let isValidSwizzle = true
                let indices: number[] = []
                for (let c of propText) {
                    if (supportedComponents.has(c)) {
                        indices.push(supportedComponents.get(c)!)
                    }
                    else {
                        isValidSwizzle = false
                        break;
                    }
                }
                if (isValidSwizzle) {
                    let newComponents: Value[] = []
                    for (let i of indices) {
                        newComponents.push(components[i])
                    }
                    return ValueUtils.makeVectorFromScalars(newComponents)
                }
            }
        }
        else if (TypeUtils.isValueOrPointerOfCategory(objRef.getType(), TypeCategory.Struct)) {
            let memberValues = ValueUtils.getStructMembers(objRef)
            if (memberValues.has(propText)) {
                return memberValues.get(propText)!
            }
        }
        this.errorNode(node, "invalid propertyAccess: " + node.getText())
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        if (this.hasNodeSymbol(node)) {
            let symbol = this.getNodeSymbol(node)
            if (this.symbolTable.has(symbol)) {
                return this.symbolTable.get(symbol)
            }
        }
        let name = node.getText()
        if (this.canEvalInKernelScopeOrTemplateArgs(node)) {
            let val = this.tryEvalInKernelScopeOrTemplateArgs(node)
            let getValue = (val: any): Value | undefined => {
                let fail = () => { this.errorNode(node, "failed to evaluate " + name + " in kernel scope") }
                if (typeof val === "number") {
                    if (val % 1 === 0) {
                        return ValueUtils.makeConstantScalar(val, this.irBuilder.get_int32(val), PrimitiveType.i32)
                    }
                    else {
                        return ValueUtils.makeConstantScalar(val, this.irBuilder.get_float32(val), PrimitiveType.f32)
                    }
                }
                else if (Array.isArray(val)) {
                    this.assertNode(node, val.length > 0, "cannot use empty array in kernel")
                    let result = getValue(val[0])
                    if (result === undefined) {
                        fail()
                    }
                    if (val.length === 1) {
                        if (result!.getType().getCategory() === TypeCategory.Scalar) {
                            return ValueUtils.makeVectorFromScalars([result!])
                        }
                        else if (result!.getType().getCategory() === TypeCategory.Vector) {
                            return ValueUtils.makeMatrixFromVectorsAsRows([result!])
                        }
                        else {
                            fail()
                        }
                    }
                    for (let i = 1; i < val.length; ++i) {
                        let thisValue = getValue(val[i])
                        if (thisValue === undefined) {
                            fail()!
                        }
                        let maybeResult = this.comma(result!, thisValue!)
                        if (maybeResult === null) {
                            this.errorNode(node, "Array element type mistach at " + node.getText())
                        }
                        else {
                            result = maybeResult
                        }
                    }
                    return result
                }
                else {
                    let valuesMap = new Map<string, Value>()
                    let keys = Object.keys(val)
                    for (let k of keys) {
                        let propVal = getValue(val[k])
                        if (propVal === undefined) {
                            fail()
                        }
                        valuesMap.set(k, propVal!)
                    }
                    return ValueUtils.makeStruct(keys, valuesMap)
                }
            }
            return getValue(val)
        }
        this.errorNode(node, "unresolved identifier: " + node.getText())
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value> {
        let identifier = node.name
        if (!node.initializer) {
            this.errorNode(node, "variable declaration must have an identifier")
        }
        let illegal_names = ["taichi", "ti", "Math"]
        for (let name of illegal_names) {
            if (name === node.name.getText()) {
                this.errorNode(node, name + " cannot be used as a local variable name")
            }
        }

        let initializer = node.initializer!
        let initValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(initializer)))
        let localVar = this.createLocalVarCopy(initValue)

        let varSymbol = this.getNodeSymbol(identifier)
        this.symbolTable.set(varSymbol, localVar)
        return localVar
    }

    protected override visitIfStatement(node: ts.IfStatement): VisitorResult<Value> {
        let condValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        this.assertNode(node, condValue.getType().getCategory() === TypeCategory.Scalar, "condition of if statement must be scalar")
        //this.assertNode(node, TypeUtils.getPrimitiveType(condValue.getType()) === PrimitiveType.i32, "condition of if statement must be i32")
        let nativeIfStmt = this.irBuilder.create_if(condValue.stmts[0])
        this.branchDepth += 1
        let trueGuard = this.irBuilder.get_if_guard(nativeIfStmt, true)
        this.dispatchVisit(node.thenStatement)
        trueGuard.delete()
        if (node.elseStatement) {
            let falseGuard = this.irBuilder.get_if_guard(nativeIfStmt, false)
            this.dispatchVisit(node.elseStatement)
            falseGuard.delete()
        }
        this.branchDepth -= 1
    }

    protected override visitBreakStatement(node: ts.BreakStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0 && this.loopStack[this.loopStack.length - 1] === LoopKind.While, "break can only be used in a while loop")
        this.irBuilder.create_break()
    }

    protected override visitContinueStatement(node: ts.ContinueStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0 && (this.loopStack[this.loopStack.length - 1] === LoopKind.For || this.loopStack[this.loopStack.length - 1] === LoopKind.While), "continue must be used inside a non-static loop")
        if (this.loopStack[this.loopStack.length - 1] === LoopKind.VertexFor || this.loopStack[this.loopStack.length - 1] === LoopKind.FragmentFor) {
            this.errorNode(node, "continue cannot be used for Vertex-For or Fragment-For")
        }
        this.irBuilder.create_continue()
    }

    protected override visitWhileStatement(node: ts.WhileStatement): VisitorResult<Value> {
        let nativeWhileTrue = this.irBuilder.create_while_true()
        let guard = this.irBuilder.get_while_loop_guard(nativeWhileTrue)

        let condValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        this.assertNode(node, condValue.getType().getCategory() === TypeCategory.Scalar, "condition of while statement must be scalar")
        let breakCondition = this.irBuilder.create_logical_not(condValue.stmts[0])
        let nativeIfStmt = this.irBuilder.create_if(breakCondition)
        let trueGuard = this.irBuilder.get_if_guard(nativeIfStmt, true)
        this.irBuilder.create_break()
        trueGuard.delete()

        this.loopStack.push(LoopKind.While)
        this.dispatchVisit(node.statement)
        this.loopStack.pop()
        guard.delete()
    }

    protected visitRangeFor(indexSymbols: ts.Symbol[], rangeExpr: ts.NodeArray<ts.Expression>, body: ts.Statement, shouldUnroll: boolean): VisitorResult<Value> {
        this.assertNode(null, rangeExpr.length === 1, "Expecting exactly 1 argument in range()")
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 loop index in range()")
        let rangeLengthExpr = rangeExpr[0]
        let rangeLengthValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(rangeLengthExpr)))
        rangeLengthValue = this.castTo(rangeLengthValue, PrimitiveType.i32)
        this.assertNode(null, rangeLengthValue.getType().getCategory() === TypeCategory.Scalar, "range must be scalar")

        if (shouldUnroll) {
            this.assertNode(null, rangeLengthValue.isCompileTimeConstant(), "for static range loops, the range must be a compile time constant")
            let rangeLength = rangeLengthValue.compileTimeConstants[0]
            this.loopStack.push(LoopKind.StaticFor)
            for (let i = 0; i < rangeLength; ++i) {
                let indexValue = ValueUtils.makeConstantScalar(i, this.irBuilder.get_int32(i), PrimitiveType.i32)
                this.symbolTable.set(indexSymbols[0], indexValue)
                this.dispatchVisit(body)
            }
            this.loopStack.pop()
        }
        else {
            let zero = this.irBuilder.get_int32(0)
            let loop = this.irBuilder.create_range_for(zero, rangeLengthValue.stmts[0], 0, 4, 0, false);

            let loopGuard = this.irBuilder.get_range_loop_guard(loop);
            let indexStmt = this.irBuilder.get_loop_index(loop, 0);
            let indexValue = ValueUtils.makeScalar(indexStmt, PrimitiveType.i32)
            this.symbolTable.set(indexSymbols[0], indexValue)

            this.loopStack.push(LoopKind.For)
            this.dispatchVisit(body)
            this.loopStack.pop()

            loopGuard.delete()
        }
    }

    protected visitNdrangeFor(indexSymbols: ts.Symbol[], rangeExpr: ts.NodeArray<ts.Expression>, body: ts.Statement, shouldUnroll: boolean): VisitorResult<Value> {
        let numDimensions = rangeExpr.length
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 (grouped) loop index in ndrange()")
        this.assertNode(null, numDimensions > 0, "ndrange() arg list cannot be empty")
        let lengthValues: Value[] = []
        for (let lengthExpr of rangeExpr) {
            let value = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(lengthExpr)))
            value = this.castTo(value, PrimitiveType.i32)
            this.assertNode(null, value.getType().getCategory() === TypeCategory.Scalar, "each arg to ndrange() must be a scalar")
            lengthValues.push(value)
        }
        if (shouldUnroll) {
            let totalLength = 1
            for (let len of lengthValues) {
                this.assertNode(null, len.isCompileTimeConstant(), "for static ndrange loops, each range must be a compile time constant")
                totalLength *= len.compileTimeConstants[0]
            }
            this.loopStack.push(LoopKind.StaticFor)
            for (let i = 0; i < totalLength; ++i) {
                let indexType = new VectorType(PrimitiveType.i32, numDimensions)
                let indexValue = new Value(indexType, [], [])
                let remainder = i

                for (let d = numDimensions - 1; d >= 0; --d) {
                    let thisDimLength = lengthValues[d].compileTimeConstants[0]
                    let thisIndex = remainder % thisDimLength
                    let thisIndexStmt = this.irBuilder.get_int32(thisIndex)
                    indexValue.stmts.push(thisIndexStmt)
                    indexValue.compileTimeConstants.push(thisIndex)
                    remainder = (remainder - thisIndex) / thisDimLength
                }

                this.symbolTable.set(indexSymbols[0], indexValue)
                this.dispatchVisit(body)
            }
            this.loopStack.pop()
        }
        else {
            let product = lengthValues[0].stmts[0]
            for (let i = 1; i < numDimensions; ++i) {
                product = this.irBuilder.create_mul(product, lengthValues[i].stmts[0])
            }
            let zero = this.irBuilder.get_int32(0)
            let loop = this.irBuilder.create_range_for(zero, product, 0, 4, 0, false);

            let loopGuard = this.irBuilder.get_range_loop_guard(loop);
            let flatIndexStmt = this.irBuilder.get_loop_index(loop, 0);

            let indexType = new VectorType(PrimitiveType.i32, numDimensions)
            let indexValue = new Value(indexType, [])
            let remainder = flatIndexStmt

            for (let i = numDimensions - 1; i >= 0; --i) {
                let thisDimStmt = lengthValues[i].stmts[0]
                let thisIndex = this.irBuilder.create_mod(remainder, thisDimStmt)
                indexValue.stmts = [thisIndex].concat(indexValue.stmts)
                remainder = this.irBuilder.create_floordiv(remainder, thisDimStmt)
            }
            this.symbolTable.set(indexSymbols[0], indexValue)

            this.loopStack.push(LoopKind.For)
            this.dispatchVisit(body)
            this.loopStack.pop()

            loopGuard.delete()
        }
    }

    protected isAtTopLevel() {
        return this.loopStack.length === 0 && this.branchDepth === 0
    }

    protected isFragmentFor(node: ts.Node): boolean {
        if (node.kind !== ts.SyntaxKind.ForOfStatement) {
            return false
        }
        let forOfNode = node as ts.ForOfStatement

        if (forOfNode.expression.kind !== ts.SyntaxKind.CallExpression) {
            return false
        }
        let callExpr = forOfNode.expression as ts.CallExpression
        let calledFunctionExpr = callExpr.expression
        let calledFunctionText = calledFunctionExpr.getText()
        return calledFunctionText === "input_fragments" || calledFunctionText === "ti.input_fragments"
    }

    protected visitVertexFor(indexSymbols: ts.Symbol[], vertexArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value> {
        if (!this.isAtTopLevel()) {
            this.errorNode(null, "Vertex-For must be top-level")
        }
        if (this.finishedVertex) {
            this.errorNode(null, "cannot start a new render pipeline when the previous one hasn't been finioshed")
        }
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 vertex declaration")

        this.assertNode(null, this.currentRenderPipelineParams === null, "[Compiler bug]")
        this.currentRenderPipelineParams = new RenderPipelineParams(new VertexShaderParams, new FragmentShaderParams)
        if (vertexArgs.length === 0) {
            this.errorNode(null, "Expecting vertex buffer and optionally index buffer")
        }
        if (vertexArgs.length >= 1) {

            if (this.canEvalInKernelScopeOrTemplateArgs(vertexArgs[0])) {
                let arg = this.tryEvalInKernelScopeOrTemplateArgs(vertexArgs[0])
                if (arg instanceof Field) {
                    this.currentRenderPipelineParams.vertex.VBO = arg
                }
                else {
                    this.errorNode(null, `the vertex buffer must be an instance of taichi field`)
                }
            }
            else {
                this.errorNode(null, `the vertex buffer ${vertexArgs[0].getText()} cannot be evaluated in kernel scope`)
            }
        }
        if (vertexArgs.length >= 2) {
            if (this.canEvalInKernelScopeOrTemplateArgs(vertexArgs[0])) {
                let arg = this.tryEvalInKernelScopeOrTemplateArgs(vertexArgs[0])
                if (arg instanceof Field) {
                    this.currentRenderPipelineParams.vertex.IBO = arg
                }
                else {
                    this.errorNode(null, `the index buffer must be an instance of taichi field`)
                }
            }
            else {
                this.errorNode(null, `the vertex buffer ${vertexArgs[1].getText()} cannot be evaluated in kernel scope`)
            }
        }
        if (vertexArgs.length >= 3) {
            this.errorNode(null, "Expecting only vertex buffer and index buffer")
        }
        let loop = this.irBuilder.create_vertex_for();

        let loopGuard = this.irBuilder.get_vertex_loop_guard(loop);
        this.loopStack.push(LoopKind.VertexFor);

        let vertexType = this.currentRenderPipelineParams.vertex.VBO!.elementType
        let vertexInputValue = new Value(vertexType, [])
        let prims = vertexType.getPrimitivesList()
        for (let i = 0; i < prims.length; ++i) {
            let stmt = this.irBuilder.create_vertex_input(i, toNativePrimitiveType(prims[i]))
            vertexInputValue.stmts.push(stmt)
        }
        // avoid having to throw error when assigning to vertex attribs
        let vertexInputCopy = this.createLocalVarCopy(vertexInputValue)
        this.symbolTable.set(indexSymbols[0], vertexInputCopy)

        this.startedVertex = true

        this.dispatchVisit(body)

        this.finishedVertex = true

        this.loopStack.pop()
        loopGuard.delete()
    }

    protected visitFragmentFor(indexSymbols: ts.Symbol[], fragmentArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value> {
        if (!this.isAtTopLevel()) {
            this.errorNode(null, "Fragment-For must be top-level")
        }
        if (!this.finishedVertex) {
            this.errorNode(null, "Fragment-For must follow a complete Vertex-For")
        }
        this.assertNode(null, indexSymbols.length === 1, "Expecting exactly 1 fragment declaration")

        this.assertNode(null, this.currentRenderPipelineParams !== null, "[Compiler bug]")
        if (fragmentArgs.length !== 0) {
            this.errorNode(null, "Expecting no arguments in input_fragments()")
        }

        let loop = this.irBuilder.create_fragment_for();

        let loopGuard = this.irBuilder.get_fragment_loop_guard(loop);
        this.loopStack.push(LoopKind.FragmentFor);

        this.assertNode(null, this.currentRenderPipelineParams!.interpolatedType !== null, "[Compiler bug]")

        let fragmentType = this.currentRenderPipelineParams!.interpolatedType!
        let fragmentInputValue = new Value(fragmentType, [])
        let prims = fragmentType.getPrimitivesList()
        for (let i = 0; i < prims.length; ++i) {
            let stmt = this.irBuilder.create_fragment_input(i, toNativePrimitiveType(prims[i]))
            fragmentInputValue.stmts.push(stmt)
        }
        // avoid having to throw error when assigning to fragment attribs
        let fragmentInputCopy = this.createLocalVarCopy(fragmentInputValue)
        this.symbolTable.set(indexSymbols[0], fragmentInputCopy)

        this.startedFragment = true

        this.dispatchVisit(body)

        this.startedVertex = false
        this.finishedVertex = false
        this.startedFragment = false
        this.renderPipelineParams.push(this.currentRenderPipelineParams!)
        this.currentRenderPipelineParams = null

        this.loopStack.pop()
        loopGuard.delete()
    }

    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<Value> {
        this.assertNode(node, node.initializer.kind === ts.SyntaxKind.VariableDeclarationList,
            "Expecting a `let` variable declaration list, got ", node.initializer.getText(), " ", node.initializer.kind)
        let declarationList = node.initializer as ts.VariableDeclarationList
        let loopIndexSymbols: ts.Symbol[] = []
        for (let decl of declarationList.declarations) {
            let ident = decl.name as ts.Identifier
            let symbol = this.getNodeSymbol(ident)
            loopIndexSymbols.push(symbol)
        }

        if (node.expression.kind === ts.SyntaxKind.CallExpression) {
            let callExpr = node.expression as ts.CallExpression
            let calledFunctionExpr = callExpr.expression
            let calledFunctionText = calledFunctionExpr.getText()
            if (calledFunctionText === "range" || calledFunctionText === "ti.range") {
                return this.visitRangeFor(loopIndexSymbols, callExpr.arguments, node.statement, false)
            }
            else if (calledFunctionText === "ndrange" || calledFunctionText === "ti.ndrange") {
                return this.visitNdrangeFor(loopIndexSymbols, callExpr.arguments, node.statement, false)
            }
            else if (calledFunctionText === "input_vertices" || calledFunctionText === "ti.input_vertices") {
                return this.visitVertexFor(loopIndexSymbols, callExpr.arguments, node.statement)
            }
            else if (calledFunctionText === "input_fragments" || calledFunctionText === "ti.input_fragments") {
                return this.visitFragmentFor(loopIndexSymbols, callExpr.arguments, node.statement)
            }
            else if (calledFunctionText === "static" || calledFunctionText === "ti.static") {
                let errMsg = "expecting a single range(...) or ndrange(...) within static(...)"
                this.assertNode(node, callExpr.arguments.length === 1, errMsg)
                let innerExpr = callExpr.arguments[0]
                this.assertNode(node, innerExpr.kind === ts.SyntaxKind.CallExpression, errMsg)
                let innerCallExpr = innerExpr as ts.CallExpression
                let innerCallText = innerCallExpr.expression.getText()
                if (innerCallText === "range" || innerCallText === "ti.range") {
                    return this.visitRangeFor(loopIndexSymbols, innerCallExpr.arguments, node.statement, true)
                }
                else if (innerCallText === "ndrange" || innerCallText === "ti.ndrange") {
                    return this.visitNdrangeFor(loopIndexSymbols, innerCallExpr.arguments, node.statement, true)
                }
            }
        }
        this.errorNode(node, "unsupported for-of initializer ")
    }
    protected override visitForInStatement(node: ts.ForInStatement): VisitorResult<Value> {
        this.errorNode(node, "Please use `for ... of ...` instead of  `for ... in ...`")
    }
    protected override visitForStatement(node: ts.ForStatement): VisitorResult<Value> {
        this.errorNode(node, "Please use `for ... of ...` instead of  arbitrary for loops")
    }
}

export class InliningCompiler extends CompilingVisitor {
    constructor(
        irBuilder: NativeTaichiAny,
        builtinOps: Map<string, BuiltinOp>,
        atomicOps: Map<string, BuiltinAtomicOp>,
        public funcName: string) {
        super(irBuilder, builtinOps, atomicOps)
    }

    argValues: Value[] = []

    runInlining(parsedFunction: ParsedFunction, kernelScope: Scope, argValues: Value[]): Value | null {
        this.argValues = argValues
        this.buildIR(parsedFunction, kernelScope, new Scope())
        return this.returnValue
    }

    protected override registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        this.assertNode(null, args.length === this.argValues.length, `ti.func ${this.funcName} called with incorrect amount of variables`)
        for (let i = 0; i < args.length; ++i) {
            let val = this.argValues[i]
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol, val)
        }
    }

    protected override visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value> {
        if (this.returnValue) {
            this.errorNode(node, "ti.func can only have at most one return statements")
        }
        if (this.branchDepth > 0 || this.loopStack.length > 0) {
            this.errorNode(node, "return cannot be used inside a loop/branch")
        }
        if (node.expression) {
            this.returnValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        }
        else {
            this.returnValue = new Value(new VoidType())
        }
    }

    protected override visitVertexFor(indexSymbols: ts.Symbol[], vertexArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value> {
        this.errorNode(null, "Vertex-For not allowed in non-kernel functions")
    }

    protected override visitFragmentFor(indexSymbols: ts.Symbol[], fragmentArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value> {
        this.errorNode(null, "Fragment-For not allowed in non-kernel functions")
    }
}
export class KernelCompiler extends CompilingVisitor {
    constructor() {
        let irBuilder = new nativeTaichi.IRBuilder()
        let builtinOps = BuiltinOpFactory.getBuiltinOps(irBuilder)
        let atomicOps = BuiltinOpFactory.getAtomicOps(irBuilder)

        super(irBuilder, builtinOps, atomicOps)

        this.kernelArgTypes = []
        this.argTypesMap = new Map<string, Type>()
        this.templateArgumentValues = null
    }

    nativeKernel: NativeTaichiAny
    kernelArgTypes: Type[] // this is the argTypes of the resulting kernel, that is, template arguments have been removed
    argTypesMap: Map<string, Type>
    templateArgumentValues: Map<string, any> | null // JS argument values. This only used when the kernel contains template arguments

    compileKernel(
        parsedFunction: ParsedFunction,
        scope: Scope,
        argTypesMap: Map<string, Type>,
        templateArgumentValues: Map<string, any> | null = null): KernelParams {
        this.argTypesMap = argTypesMap
        this.templateArgumentValues = templateArgumentValues
        let templatedValuesScope = new Scope()
        if (templateArgumentValues !== null) {
            for (let name of templateArgumentValues.keys()) {
                templatedValuesScope.addStored(name, templateArgumentValues.get(name)!)
            }
        }
        this.buildIR(parsedFunction, scope, templatedValuesScope)

        if (!this.compilationResultName) {
            this.compilationResultName = Program.getCurrentProgram().getAnonymousKernelName()
        }

        this.nativeKernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram, this.irBuilder, this.compilationResultName, false)
        for (let type of this.kernelArgTypes) {
            let prims = type.getPrimitivesList()
            for (let prim of prims) {
                this.nativeKernel.insert_arg(toNativePrimitiveType(prim), false)
            }
        }
        if (this.returnValue !== null && this.returnValue.getType().getCategory() !== TypeCategory.Void) {
            let prims = this.returnValue.getType().getPrimitivesList()
            for (let i = 0; i < prims.length; ++i) {
                this.nativeKernel.insert_ret(toNativePrimitiveType(prims[i]))
            }
        }

        Program.getCurrentProgram().nativeAotBuilder.add(this.compilationResultName, this.nativeKernel);

        let tasks = nativeTaichi.get_kernel_params(Program.getCurrentProgram().nativeAotBuilder, this.compilationResultName);
        let taskParams: (TaskParams | RenderPipelineParams)[] = []
        let numTasks = tasks.size()
        let currentRenderPipelineParamsId = 0
        for (let i = 0; i < numTasks; ++i) {
            let task = tasks.get(i)
            let wgsl: string = task.get_wgsl()
            let stage = getWgslShaderStage(wgsl)
            let bindings = getWgslShaderBindings(wgsl)
            if (stage === WgslShaderStage.Compute) {
                let rangeHint: string = task.get_range_hint()
                let workgroupSize = task.get_gpu_block_size()
                taskParams.push(new TaskParams(wgsl, rangeHint, workgroupSize, bindings))
            }
            else if (stage === WgslShaderStage.Vertex) {
                let params = this.renderPipelineParams[currentRenderPipelineParamsId]
                params.vertex.code = wgsl
                if (bindings.length > 0) {
                    this.errorNode(null, "the vertex-shader is not allowed to access taichi fields")
                }
                params.vertex.bindings = bindings
            }
            else if (stage === WgslShaderStage.Fragment) {
                let params = this.renderPipelineParams[currentRenderPipelineParamsId]
                params.fragment.code = wgsl
                params.fragment.bindings = bindings

                params.bindings = params.getBindings()
                taskParams.push(params)
                currentRenderPipelineParamsId++;
            }
            //console.log(wgsl)
        }
        this.nativeKernel.delete()
        this.irBuilder.delete()
        let returnType = new VoidType()
        if (this.returnValue !== null) {
            returnType = this.returnValue!.getType()
        }
        return new KernelParams(taskParams, this.kernelArgTypes, returnType)
    }

    protected override registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        let argNames: string[] = []
        for (let i = 0; i < args.length; ++i) {
            argNames.push(args[i].name.getText())
        }
        for (let arg of this.argTypesMap.keys()) {
            if (argNames.indexOf(arg) === -1) {
                this.errorNode(args[0], `Invalid argument type annotaions: the annotated argument ${arg} is not in the function argument list`)
            }
        }
        let argStmtId = 0
        for (let i = 0; i < args.length; ++i) {
            let arg = argNames[i]
            if (this.templateArgumentValues !== null && this.templateArgumentValues.has(arg)) {
                continue
            }
            if (!this.argTypesMap.has(arg)) {
                this.argTypesMap.set(arg, new ScalarType(PrimitiveType.f32))
            }
            let type = this.argTypesMap.get(arg)!
            this.kernelArgTypes.push(type)
            let val = new Value(type, [])
            let prims = type.getPrimitivesList()
            for (let prim of prims) {
                val.stmts.push(this.irBuilder.create_arg_load(argStmtId++, toNativePrimitiveType(prim), false))
            }
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol, val)
        }
    }

    protected override visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value> {
        if (this.returnValue) {
            this.errorNode(node, "ti.func can only have at most one return statements")
        }
        if (this.branchDepth > 0 || this.loopStack.length > 0) {
            this.errorNode(node, "return cannot be used inside a loop/branch")
        }
        if (node.expression) {
            this.returnValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
            let returnStmtsVec: NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
            for (let stmt of this.returnValue.stmts) {
                returnStmtsVec.push_back(stmt)
            }
            this.irBuilder.create_return_vec(returnStmtsVec)
        }
        else {
            this.returnValue = new Value(new VoidType())
            let returnStmtsVec: NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
            this.irBuilder.create_return_vec(returnStmtsVec)
        }
    }
}
