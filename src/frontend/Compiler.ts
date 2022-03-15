import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import { ASTVisitor, VisitorResult } from "./ast/Visiter"
import { CompiledKernel, TaskParams, BufferBinding, BufferType, KernelParams } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny } from '../native/taichi/GetTaichi'
import { error, assert } from '../utils/Logging'
import { GlobalScope } from "../program/GlobalScope";
import { Field } from "../program/Field";
import { Program } from "../program/Program";
import { getStmtKind, StmtKind } from "./Stmt"
import { getWgslShaderBindings } from "./WgslReflection"
import { LibraryFunc } from "./Library";
import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, TypeUtils, PrimitiveType, toNativePrimitiveType, TypeError } from "./Type"
import { Value, ValueUtils } from "./Value"
import { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory } from "./BuiltinOp";
import { ResultOrError } from "./Error";
export class CompilerContext {
    protected host: InMemoryHost
    constructor() {
        this.host = new InMemoryHost()
    }

    public createProgramFromSource(source: string, options: ts.CompilerOptions) {
        let tempFileName = "temp.js"
        this.host.writeFile(tempFileName, source)
        return ts.createProgram([tempFileName], options, this.host);
    }
}

enum LoopKind {
    For, While
}

class CompilingVisitor extends ASTVisitor<Value>{ // It's actually a ASTVisitor<Stmt>, but we don't have the types yet
    constructor(
        protected irBuilder: NativeTaichiAny,
        protected builtinOps: Map<string, BuiltinOp>,
        protected atomicOps: Map<string, BuiltinAtomicOp>,
        protected scope: GlobalScope) {
        super()
        this.context = new CompilerContext()
        this.symbolTable = new Map<ts.Symbol, Value>()
    }
    protected context: CompilerContext
    protected tsProgram?: ts.Program
    protected typeChecker?: ts.TypeChecker

    protected symbolTable: Map<ts.Symbol, Value>;

    public compilationResultName: string | null = null

    protected loopStack: LoopKind[] = []

    protected numArgs: number = 0
    protected hasRet: boolean = false
    protected lastVisitedNode: ts.Node | null = null

    buildIR(code: any) {
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

        this.tsProgram = this.context.createProgramFromSource(codeString, tsOptions)
        this.errorTsDiagnostics(this.tsProgram.getSyntacticDiagnostics())
        this.typeChecker = this.tsProgram.getTypeChecker()

        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file, got ", sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement in ti.kernel (A single function or arrow function)")
        if (statements[0].kind === ts.SyntaxKind.FunctionDeclaration) {
            let func = statements[0] as ts.FunctionDeclaration
            this.compilationResultName = func.name!.text
            this.registerArguments(func.parameters)
            this.visitEachChild(func.body!)
        }
        else if (statements[0].kind === ts.SyntaxKind.ExpressionStatement &&
            (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction) {
            let func = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(func.parameters)
            let body = func.body
            if (body.kind === ts.SyntaxKind.Block) {
                this.visitEachChild(func.body)
            }
            else {
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

    protected extractValueOrError(valueOrError: ResultOrError<Value>, node: ts.Node | null, ...args: any): Value {
        if (valueOrError.isError) {
            this.errorNode(node, valueOrError.errorMessage, ...args)
        }
        return valueOrError.result!
    }

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        this.numArgs = args.length
        for (let i = 0; i < this.numArgs; ++i) {
            // only support `number` args for ow
            let val = new Value(new ScalarType(PrimitiveType.f32), [])
            val.stmts.push(this.irBuilder.create_arg_load(i, toNativePrimitiveType(PrimitiveType.f32), false))
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol, val)
        }
    }

    protected getNodeSymbol(node: ts.Node): ts.Symbol {
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if (symbol === undefined) {
            this.errorNode(node, "symbol not found for " + node.getText())
        }
        return symbol!
    }

    protected getSourceCodeAt(startPos: number, endPos: number): string {
        let sourceFile = this.tsProgram!.getSourceFiles()[0]
        let startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line
        let endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line

        let start = sourceFile.getLineStarts()[startLine]
        let end = sourceFile.getLineStarts()[endLine + 1]
        let code = sourceFile.getText().slice(start, end)
        return code
    }

    protected errorTsDiagnostics(diags: readonly ts.DiagnosticWithLocation[]) {
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

        let atomicOps = this.atomicOps
        for (let kv of atomicOps) {
            let op = kv[1]
            if (funcText === op.name || funcText === "ti." + op.name) {
                checkNumArgs(2)
                let destPtr = this.extractVisitorResult(this.dispatchVisit(node.arguments[0]))
                let val = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.arguments[1])))
                let typeError = op.checkType([destPtr, val])
                if (typeError.hasError) {
                    this.errorNode(node, "Atomic type error: ", typeError.msg)
                }
                return op.apply([destPtr, val])
            }
        }

        let argumentRefs: Value[] = []  // pointer for l-values, values for r-values
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
        // function semantics: pass by ref for l-values, pass by value for r-values

        // user defined funcs
        if (this.scope.hasStored(funcText)) {
            let funcObj = this.scope.getStored(funcText)
            if (typeof funcObj == 'function') {
                let compiler = new InliningCompiler(this.scope, this.irBuilder, this.builtinOps, this.atomicOps, funcText)
                let result = compiler.runInlining(argumentRefs, funcObj)
                if (result) {
                    return result
                }
                return
            }
        }

        let libraryFuncs = LibraryFunc.getLibraryFuncs()
        for (let kv of libraryFuncs) {
            let func = kv[1]
            if (funcText === func.name || funcText === "ti." + func.name) {
                let compiler = new InliningCompiler(this.scope, this.irBuilder, this.builtinOps, this.atomicOps, funcText)
                let result = compiler.runInlining(argumentRefs, func.code)
                if (result) {
                    return result
                }
                return
            }
        }

        let argumentValues: Value[] = []
        for (let ref of argumentRefs) {
            argumentValues.push(this.derefIfPointer(ref))
        }

        let builtinOps = this.builtinOps
        for (let kv of builtinOps) {
            let op = kv[1]
            if (funcText === op.name || funcText === "ti." + op.name || funcText === "Math." + op.name) {
                checkNumArgs(op.arity)
                let typeError = op.checkType(argumentValues)
                if (typeError.hasError) {
                    this.errorNode(node, "Builtin op error: ", typeError.msg)
                }
                return op.apply(argumentValues)
            }
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
                let allArgumentValues = [objValue].concat(argumentValues)

                let typeError = op.checkType(allArgumentValues)
                if (typeError.hasError) {
                    this.errorNode(node, "Builtin op error: ", typeError.msg)
                }
                return op.apply(allArgumentValues)
            }

        }

        this.errorNode(node, "unresolved function: " + funcText)
    }

    protected override visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
        let base = node.expression
        let argument = node.argumentExpression
        if (base.kind === ts.SyntaxKind.Identifier) {
            let baseName = base.getText()
            if (this.scope.hasStored(baseName) && this.typeChecker!.getSymbolAtLocation(base) === undefined) {
                let hostSideValue: any = this.scope.getStored(baseName)
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
        let symbol = this.typeChecker!.getSymbolAtLocation(node)
        if (symbol && this.symbolTable.has(symbol)) {
            return this.symbolTable.get(symbol)
        }
        let name = node.getText()
        if (this.scope.hasStored(name)) {
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
                if (Array.isArray(val)) {
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
            }
            let val = this.scope.getStored(name)
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
        let trueGuard = this.irBuilder.get_if_guard(nativeIfStmt, true)
        this.dispatchVisit(node.thenStatement)
        trueGuard.delete()
        if (node.elseStatement) {
            let falseGuard = this.irBuilder.get_if_guard(nativeIfStmt, false)
            this.dispatchVisit(node.elseStatement)
            falseGuard.delete()
        }
    }

    protected override visitBreakStatement(node: ts.BreakStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0 && this.loopStack[this.loopStack.length - 1] === LoopKind.While, "break can only be used in a while loop")
        this.irBuilder.create_break()
    }

    protected override visitContinueStatement(node: ts.ContinueStatement): VisitorResult<Value> {
        this.assertNode(node, this.loopStack.length > 0, "continue must be used inside a loop")
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
            for (let i = 0; i < rangeLength; ++i) {
                let indexValue = ValueUtils.makeConstantScalar(i, this.irBuilder.get_int32(i), PrimitiveType.i32)
                this.symbolTable.set(indexSymbols[0], indexValue)
                this.dispatchVisit(body)
            }
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
            //console.log("total length ",totalLength)
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
        scope: GlobalScope,
        irBuilder: NativeTaichiAny,
        builtinOps: Map<string, BuiltinOp>,
        atomicOps: Map<string, BuiltinAtomicOp>,
        public funcName: string) {
        super(irBuilder, builtinOps, atomicOps, scope)
    }

    argValues: Value[] = []
    returnValue: Value | null = null

    runInlining(argValues: Value[], code: any): Value | null {
        this.argValues = argValues
        this.buildIR(code)
        return this.returnValue
    }

    protected override registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        this.numArgs = args.length
        this.assertNode(null, this.numArgs === this.argValues.length, `ti.func ${this.funcName} called with incorrect amount of variables`)
        for (let i = 0; i < this.numArgs; ++i) {
            let val = this.argValues[i]
            let symbol = this.getNodeSymbol(args[i].name)
            this.symbolTable.set(symbol, val)
        }
    }

    protected override visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value> {
        if (this.returnValue) {
            this.errorNode(node, "ti.func can only have at most one return statements")
        }
        if (node.expression) {
            this.returnValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        }
    }
}
export class OneTimeCompiler extends CompilingVisitor {
    constructor(scope: GlobalScope) {
        let irBuilder = new nativeTaichi.IRBuilder()
        let builtinOps = BuiltinOpFactory.getBuiltinOps(irBuilder)
        let atomicOps = BuiltinOpFactory.getAtomicOps(irBuilder)
        super(irBuilder, builtinOps, atomicOps, scope)
    }
    compileKernel(code: any): KernelParams {
        this.buildIR(code)

        if (!this.compilationResultName) {
            this.compilationResultName = Program.getCurrentProgram().getAnonymousKernelName()
        }

        let kernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram, this.irBuilder, this.compilationResultName, false)
        for (let i = 0; i < this.numArgs; ++i) {
            kernel.insert_arg(toNativePrimitiveType(PrimitiveType.f32), false)
        }

        Program.getCurrentProgram().nativeAotBuilder.add(this.compilationResultName, kernel);

        let tasks = nativeTaichi.get_kernel_params(Program.getCurrentProgram().nativeAotBuilder, this.compilationResultName);
        let taskParams: TaskParams[] = []
        let numTasks = tasks.size()
        for (let i = 0; i < numTasks; ++i) {
            let task = tasks.get(i)
            let wgsl: string = task.get_wgsl()
            //console.log(wgsl)

            let bindings = getWgslShaderBindings(wgsl)
            //console.log(bindings)
            let rangeHint: string = task.get_range_hint()
            let workgroupSize = task.get_gpu_block_size()
            taskParams.push({
                code: wgsl,
                rangeHint,
                workgroupSize,
                bindings
            })
        }
        kernel.delete()
        this.irBuilder.delete()
        return new KernelParams(taskParams, this.numArgs)
    }
}