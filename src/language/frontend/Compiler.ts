import * as ts from "typescript";
import { ASTVisitor, VisitorResult } from "./ast/Visiter"
import { TaskParams, ResourceBinding, ResourceType, KernelParams, RenderPipelineParams, VertexShaderParams, FragmentShaderParams, RenderPassParams } from "../../runtime/Kernel";
import { error } from "../../utils/Logging"
import { Scope } from "./Scope";
import { Field } from "../../data/Field";
import { DepthTexture, getTextureCoordsNumComponents, isTexture, TextureBase } from "../../data/Texture";
import { Program } from "../../program/Program";
import { LibraryFunc } from "./Library";
import { Type, TypeCategory, ScalarType, VectorType, PointerType, VoidType, TypeUtils, PrimitiveType, FunctionType } from "./Type"
import { Value, ValueUtils } from "./Value"
import { BuiltinOp, BuiltinAtomicOp, BuiltinOpFactory } from "./BuiltinOp";
import { ResultOrError } from "./Error";
import { ParsedFunction } from "./ParsedFunction";
import { beginWith, isHostSideVectorOrMatrix, isPlainOldData } from "../../utils/Utils";
import { FieldFactory } from "../../data/FieldFactory";
import { IRBuilder } from "../ir/Builder";
import { FragmentDerivativeStmt, Stmt } from "../ir/Stmt";
import { identifyParallelLoops } from "../ir/pass/IdentifyParallelLoops";
import { insertGlobalTemporaries } from "../ir/pass/GlobalTemporaries";
import { demoteAtomics } from "../ir/pass/DemoteAtomics";
import { offload, OffloadType } from "../codegen/Offload";
import { CodegenVisitor } from "../codegen/WgslCodegen";
import { stringifyIR } from "../ir/pass/Printer";



enum LoopKind {
    For, While, VertexFor, FragmentFor
}

type SymbolTable = Map<ts.Symbol, Value>

class CompilingVisitor extends ASTVisitor<Value>{
    constructor(
        protected irBuilder: IRBuilder,
        protected builtinOps: Map<string, BuiltinOp>,
        protected atomicOps: Map<string, BuiltinAtomicOp>,
    ) {
        super()

    }

    protected kernelScope: Scope = new Scope()
    protected templatedValues: Scope = new Scope()
    protected symbolTable: SymbolTable = new Map<ts.Symbol, Value>()
    protected parsedFunction: ParsedFunction | null = null

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
    protected renderPassParams: RenderPassParams | null = null

    buildIR(parsedFunction: ParsedFunction, kernelScope: Scope, templatedValues: Scope) {
        this.kernelScope = kernelScope
        this.templatedValues = templatedValues
        this.parsedFunction = parsedFunction

        let functionNode = this.parsedFunction!.functionNode!
        if (functionNode.kind === ts.SyntaxKind.FunctionDeclaration) {
            let func = functionNode as ts.FunctionDeclaration
            this.registerArguments(func.parameters)
            this.visitInputFunctionBody(func.body!)
        }
        else if (functionNode.kind === ts.SyntaxKind.ArrowFunction) {
            let func = functionNode as ts.ArrowFunction
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
        //console.log(this.parsedFunction!.getNodeSourceCode(node), node)
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

    /*
    * e.g.:
    * "x.y" => symbol(x)
    * "x.y.z" => symbol(x)
    * "x.y.z[0]" => symbol(x)
    * "x.y.z[0].f()" => symbol(x)
    */
    protected getNodeBaseSymbol(node: ts.Node): ts.Symbol | undefined {
        while (true) {
            if (this.hasNodeSymbol(node)) {
                if (node.kind === ts.SyntaxKind.ThisKeyword) {
                    // TS always recognizes assigns the `globalThis` symbol to `this`.
                    // we shuold consider it as No-symbol.
                    return undefined
                }
                return this.getNodeSymbol(node)
            }
            else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
                let access = node as ts.PropertyAccessExpression
                node = access.expression
            }
            else if (node.kind === ts.SyntaxKind.ElementAccessExpression) {
                let access = node as ts.ElementAccessExpression
                node = access.expression
            }
            else if (node.kind === ts.SyntaxKind.CallExpression) {
                let call = node as ts.CallExpression
                node = call.expression
            }
            else {
                return undefined
            }
        }
    }

    // node: an identifier or property access epxreesion
    // returns a JS value if the expr can be evaluated in kernel scope (i.e. the scope created by ti.addToKernelScope) or in template args
    protected tryEvalInKernelScopeOrTemplateArgs(node: ts.Node): any {
        let exprText = node.getText()
        let baseSymbol = this.getNodeBaseSymbol(node)
        if (baseSymbol !== undefined) {
            // ts has created a symbol for this node. 
            // This means the expr isn't "free", in the sense of https://en.wikipedia.org/wiki/Free_variables_and_bound_variables
            // As a result, it mustn't be treated as a kernel scope expr. 
            let foundInArgs = false
            for (let argNode of this.parsedFunction!.argNodes) {
                if (this.getNodeSymbol(argNode.name) === baseSymbol) {
                    foundInArgs = true
                    break
                }
            }
            if (!foundInArgs) {
                // the node corresponds to a non-argument node, so it is a local var
                return undefined
            }
            if (!this.templatedValues.canEvaluate(exprText)) {
                // a non-template argument
                return undefined
            }
            return this.templatedValues.tryEvaluate(exprText)
        }
        else {
            // "free" expr. 
            return this.kernelScope.tryEvaluate(exprText)
        }
    }

    protected canEvalInKernelScopeOrTemplateArgs(node: ts.Node): boolean {
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
            let alloca = this.irBuilder.create_local_var(primitiveTypes[i])
            varValue.stmts.push(alloca)
            this.irBuilder.create_local_store(alloca, val.stmts[i])
        }
        return varValue
    }

    protected comma(leftValue: Value, rightValue: Value): Value {
        let commaOp = this.builtinOps.get(",")!
        let typeError = commaOp.checkType([leftValue, rightValue])
        if (typeError.hasError) {
            this.errorNode(null, typeError.msg)
        }
        return commaOp.apply([leftValue, rightValue])
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
            if (value > 2 ** 32 - 1) {
                this.errorNode(node, `${node.getText()} cannot be expressed as a 32-bit integer`)
            }
            if (value > 2 ** 31 - 1) {
                // this can only be expressed as u32.
                // we compute the i32 with the identical bit pattern here
                value = value - 2 ** 32
            }
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
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let leftType = left.getType()
        let rightValue = this.derefIfPointer(right)
        let opToken = node.operatorToken
        let opTokenText = opToken.getText()
        if (opToken.kind === ts.SyntaxKind.EqualsToken) {
            if (leftType.getCategory() != TypeCategory.Pointer) {
                this.errorNode(node, "Left hand side of assignment must be an l-value. ", leftType.getCategory())
            }
            let leftPointerType = leftType as PointerType
            if (this.isInVertexOrFragmentFor() && leftPointerType.getIsGlobal()) {
                this.errorNode(node, "vertex/fragment shaders are not allowed to write to global temporary variables or global fields.")
            }
            let storeOp = this.builtinOps.get("=")!
            let typeError = storeOp.checkType([left, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, "Assignment type error: " + typeError.msg)
            }
            storeOp.apply([left, rightValue])
            return
        }

        let opAssignTokenToAtomicOp = new Map<ts.SyntaxKind, BuiltinOp>()
        opAssignTokenToAtomicOp.set(ts.SyntaxKind.PlusEqualsToken, this.atomicOps.get("atomicAdd")!);
        opAssignTokenToAtomicOp.set(ts.SyntaxKind.MinusEqualsToken, this.atomicOps.get("atomicSub")!);
        opAssignTokenToAtomicOp.set(ts.SyntaxKind.AmpersandEqualsToken, this.atomicOps.get("atomicAnd")!);
        opAssignTokenToAtomicOp.set(ts.SyntaxKind.BarEqualsToken, this.atomicOps.get("atomicOr")!);
        opAssignTokenToAtomicOp.set(ts.SyntaxKind.CaretEqualsToken, this.atomicOps.get("atomicXor")!);

        if (opAssignTokenToAtomicOp.has(opToken.kind)) {
            let atomicOp = opAssignTokenToAtomicOp.get(opToken.kind)!
            let typeError = atomicOp.checkType([left, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, "Atomic type error: " + typeError.msg)
            }
            return atomicOp.apply([left, rightValue])
        }

        let leftValue = this.derefIfPointer(left)

        let opAssignTokenToMathOp = new Map<ts.SyntaxKind, BuiltinOp>()
        opAssignTokenToMathOp.set(ts.SyntaxKind.AsteriskEqualsToken, this.builtinOps.get("*")!);
        opAssignTokenToMathOp.set(ts.SyntaxKind.SlashEqualsToken, this.builtinOps.get("/")!);
        if (opAssignTokenToMathOp.has(opToken.kind)) {
            let op = opAssignTokenToMathOp.get(opToken.kind)!
            let typeError = op.checkType([leftValue, rightValue])
            if (typeError.hasError) {
                this.errorNode(node, "self assignment type error: " + typeError.msg)
            }
            let result = op.apply([leftValue, rightValue])
            let storeOp = this.builtinOps.get("=")!
            typeError = storeOp.checkType([left, result])
            if (typeError.hasError) {
                this.errorNode(node, "self assignment type error: " + typeError.msg)
            }
            storeOp.apply([left, result])
            return result
        }

        if (leftValue.getType().getCategory() === TypeCategory.HostObjectReference && rightValue.getType().getCategory() === TypeCategory.HostObjectReference) {
            try {
                let evaluator = Function(`x`, `y`, `return x ${opTokenText} y;`)
                let result = evaluator(leftValue.hostSideValue, rightValue.hostSideValue)
                return this.getValueFromAnyHostValue(result)
            }
            catch (e) {
                this.errorNode(node, "can not evaluate " + node.getText())
            }
        }

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
            if (prop.kind === ts.SyntaxKind.PropertyAssignment || prop.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                let propAssign = prop as ts.PropertyAssignment | ts.ShorthandPropertyAssignment
                let name = propAssign.name.getText()
                keys.push(name)
                if (prop.kind === ts.SyntaxKind.PropertyAssignment) {
                    propAssign = propAssign as ts.PropertyAssignment
                    let val = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(propAssign.initializer)))
                    memberValues.set(name, val)
                    memberTypes[name] = val.getType()
                }
                else {
                    propAssign = propAssign as ts.ShorthandPropertyAssignment
                    let valueSymbol = this.parsedFunction!.typeChecker!.getShorthandAssignmentValueSymbol(propAssign)
                    if (valueSymbol && this.symbolTable.has(valueSymbol)) {
                        let val = this.derefIfPointer(this.symbolTable.get(valueSymbol)!)
                        memberValues.set(name, val)
                        memberTypes[name] = val.getType()
                    }
                }
            }
            else {
                this.errorNode(prop, "expecting property assignment")
            }
        }
        let structValue = ValueUtils.makeStruct(keys, memberValues)
        return structValue
    }

    protected override visitParenthesizedExpression(node: ts.ParenthesizedExpression): VisitorResult<Value> {
        return this.extractVisitorResult(this.dispatchVisit(node.expression))
    }

    protected ensureRenderPassParams() {
        if (this.renderPassParams === null) {
            this.renderPassParams = {
                colorAttachments: [],
                depthAttachment: null
            }
        }
    }

    // returns the location
    protected ensureColorAttachment(target: TextureBase): number {
        let targetLocation = -1
        let existingTargets = this.renderPassParams!.colorAttachments
        for (let i = 0; i < existingTargets.length; ++i) {
            if (existingTargets[i].texture.textureId === target.textureId) {
                targetLocation = i
                break
            }
        }
        if (targetLocation === -1) {
            // a new target
            targetLocation = existingTargets.length
            existingTargets.push({
                texture: target
            })
        }
        return targetLocation
    }

    protected isBuiltinFunctionWithName(funcText: string, builtinName: string): boolean {
        return funcText === builtinName || funcText === "ti." + builtinName ||
            // typescript likes to translate "ti.ndrange" into "ndrange$1"
            (funcText.length === builtinName.length + 2 && beginWith(funcText, builtinName) && funcText[builtinName.length] === "$")
    }

    protected isBuiltinMathFunctionWithName(funcText: string, builtinName: string): boolean {
        return this.isBuiltinFunctionWithName(funcText, builtinName) || funcText === "Math." + builtinName
    }

    protected isRenderingBuiltinFunction(funcText: string): boolean {
        let functions = [
            "outputVertex",
            "outputPosition",
            "clearColor",
            "useDepth",
            "outputColor",
            "outputDepth",
            "discard",
            "textureSample",
            "textureSampleLod",
            "textureLoad",
            "textureStore",
            "getVertexIndex",
            "getInstanceIndex",
            "dpdx",
            "dpdy",
        ]
        for (let f of functions) {
            if (this.isBuiltinFunctionWithName(funcText, f)) {
                return true;
            }
        }
        return false
    }

    protected handleRenderingBuiltinFunction(funcText: string, argumentValues: Value[], node: ts.CallExpression): VisitorResult<Value> {
        if (this.isBuiltinFunctionWithName(funcText, "outputVertex")) {
            this.assertNode(node, argumentValues.length === 1, "outputVertex() must have exactly 1 argument")
            let vertexOutput = argumentValues[0]
            this.assertNode(node, this.startedVertex && !this.finishedVertex, "outputVertex() can only be used inside a vertex-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")
            this.currentRenderPipelineParams!.interpolatedType = vertexOutput.getType()
            let prims = vertexOutput.getType().getPrimitivesList()
            for (let i = 0; i < prims.length; ++i) {
                this.irBuilder.create_vertex_output(i, vertexOutput.stmts[i])
            }
            return
        }
        if (this.isBuiltinFunctionWithName(funcText, "outputPosition")) {
            this.assertNode(node, argumentValues.length === 1, "outputPosition must have exactly 1 argument")
            let posOutput = argumentValues[0]
            this.assertNode(node, this.startedVertex && !this.finishedVertex, "outputPosition() can only be used inside a vertex-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")

            this.assertNode(node, posOutput.getType().getCategory() === TypeCategory.Vector, "position output must be a vector")
            let outputVecType = posOutput.getType() as VectorType
            this.assertNode(node, outputVecType.getNumRows() === 4, "position output must be a 4D f32 vector")
            this.assertNode(node, outputVecType.getPrimitiveType() === PrimitiveType.f32, "position output must be a 4D f32 vector")

            this.irBuilder.create_position_output(posOutput.stmts.slice())
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "clearColor")) {
            this.assertNode(node, this.isAtTopLevel(), "clearColor() can only be called at top level")
            this.ensureRenderPassParams()

            this.assertNode(node, node.arguments.length === 2, "clearColor() must have exactly 2 arguments, one for cleared texture, the other for the clear value")

            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of clearColor() must be a texture object that's visible in kernel scope")
            let targetTexture = argumentValues[0].hostSideValue as TextureBase
            let targetLocation = this.ensureColorAttachment(targetTexture)

            let clearValue = argumentValues[1]
            this.assertNode(node, clearValue.getType().getCategory() === TypeCategory.Vector, "clear value must be a vector")
            let clearVecType = clearValue.getType() as VectorType
            this.assertNode(node, clearVecType.getNumRows() === 4, "color clear value must have 4 components")
            this.assertNode(node, clearValue.isCompileTimeConstant(), "color clear value must be a compile-time constant")

            this.renderPassParams!.colorAttachments[targetLocation].clearColor = clearValue.compileTimeConstants
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "useDepth")) {
            this.assertNode(node, this.isAtTopLevel(), "useDepth() can only be called at top level")
            this.ensureRenderPassParams()

            this.assertNode(node, node.arguments.length === 1, "useDepth() must have exactly 1 argument, i.e. the depth texture")

            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && argumentValues[0].hostSideValue instanceof DepthTexture, "the first argument of useDepth() must be a depth texture object that's visible in kernel scope")
            let depthTexture = argumentValues[0].hostSideValue as DepthTexture

            this.assertNode(node, this.renderPassParams!.depthAttachment === null, "the depth texture has already been specified")
            this.renderPassParams!.depthAttachment = {
                texture: depthTexture,
                clearDepth: 1.0,
                storeDepth: true
            }
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "outputColor")) {
            this.assertNode(node, this.startedFragment, "outputColor() can only be used inside a fragment-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")

            this.assertNode(node, node.arguments.length === 2, "outputColor() must have exactly 2 arguments, one for output texture, the other for the output value")
            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of outputColor() must be a texture object that's visible in kernel scope")
            let targetTexture = argumentValues[0].hostSideValue as TextureBase
            let targetLocation = this.ensureColorAttachment(targetTexture)

            let fragOutput = argumentValues[1]
            this.assertNode(node, fragOutput.getType().getCategory() === TypeCategory.Vector, "frag output must be a vector")
            let outputVecType = fragOutput.getType() as VectorType
            this.assertNode(node, outputVecType.getNumRows() === 1 || outputVecType.getNumRows() === 2 || outputVecType.getNumRows() === 4, "output vector component count must be 1, 2, or 4")
            this.assertNode(node, outputVecType.getPrimitiveType() === PrimitiveType.f32, "position output must be a f32 vector")

            this.irBuilder.create_color_output(targetLocation, fragOutput.stmts.slice())
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "outputDepth")) {
            this.assertNode(node, this.startedFragment, "outputDepth() can only be used inside a fragment-for")
            this.assertNode(node, this.currentRenderPipelineParams !== null, "[Compiler bug]")

            this.assertNode(node, node.arguments.length === 1, "outputDepth() must have exactly 1 arguments")
            let depthOutput = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.arguments[0])))
            this.assertNode(node, depthOutput.getType().getCategory() === TypeCategory.Scalar, "depth output must be a scalar")
            let outputScalarType = depthOutput.getType() as ScalarType
            this.assertNode(node, outputScalarType.getPrimitiveType() === PrimitiveType.f32, "depth output must be a f32 scalar")

            this.irBuilder.create_depth_output(depthOutput.stmts[0])
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "discard")) {
            this.assertNode(node, this.startedFragment, "discard() can only be used inside a fragment-for")
            this.irBuilder.create_discard()
            return
        }

        if (this.isBuiltinFunctionWithName(funcText, "textureSample")) {
            // TODO: error check this, but also handle textureSample callde inside functions
            //this.assertNode(node, this.startedFragment, "textureSample() can only be used inside a fragment-for") 

            this.assertNode(node, node.arguments.length === 2, "textureSample() must have exactly 2 arguments, one for texture, the other for the coordinates")
            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of textureSample() must be a texture object that's visible in kernel scope")
            let texture = argumentValues[0].hostSideValue as TextureBase
            let dim = texture.getTextureDimensionality()

            let coords = argumentValues[1]
            this.assertNode(node, coords.getType().getCategory() === TypeCategory.Vector, "coords must be a vector")
            let vecType = coords.getType() as VectorType
            let requiredComponentCount = getTextureCoordsNumComponents(dim)
            this.assertNode(node, vecType.getNumRows() === requiredComponentCount, `coords component count must be ${requiredComponentCount}`)
            this.assertNode(node, vecType.getPrimitiveType() === PrimitiveType.f32, "coords must be a f32 vector")

            let sampleResultStmt = this.irBuilder.create_texture_sample(texture, coords.stmts.slice())

            let resultType = new VectorType(PrimitiveType.f32, 4)
            let result = new Value(resultType)
            for (let i = 0; i < 4; ++i) {
                result.stmts.push(this.irBuilder.create_composite_extract(sampleResultStmt, i))
            }
            return result
        }

        if (this.isBuiltinFunctionWithName(funcText, "textureSampleLod")) {
            // TODO: error check this, but also handle textureSampleLod called inside functions
            //this.assertNode(node, this.startedFragment, "textureSampleLod() can only be used inside a fragment-for") 

            this.assertNode(node, node.arguments.length === 3, "textureSampleLod() must have exactly 3 arguments, one for texture, one for the coordinates, one for the explicit LOD")
            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of textureSampleLod() must be a texture object that's visible in kernel scope")
            let texture = argumentValues[0].hostSideValue as TextureBase
            let dim = texture.getTextureDimensionality()

            let coords = argumentValues[1]
            this.assertNode(node, coords.getType().getCategory() === TypeCategory.Vector, "coords must be a vector")
            let vecType = coords.getType() as VectorType
            let requiredComponentCount = getTextureCoordsNumComponents(dim)
            this.assertNode(node, vecType.getNumRows() === requiredComponentCount, `coords component count must be ${requiredComponentCount}`)
            this.assertNode(node, vecType.getPrimitiveType() === PrimitiveType.f32, "coords must be a f32 vector")

            let lod = argumentValues[2]
            this.assertNode(node, lod.getType().getCategory() === TypeCategory.Scalar && TypeUtils.getPrimitiveType(lod.getType()) === PrimitiveType.f32, "lod must be a scalar float")


            let sampleResultStmt = this.irBuilder.create_texture_sample_lod(texture, coords.stmts, lod.stmts[0])

            let resultType = new VectorType(PrimitiveType.f32, 4)
            let result = new Value(resultType)
            for (let i = 0; i < 4; ++i) {
                result.stmts.push(this.irBuilder.create_composite_extract(sampleResultStmt, i))
            }
            return result
        }

        if (this.isBuiltinFunctionWithName(funcText, "textureLoad")) {

            this.assertNode(node, node.arguments.length === 2, "textureLoad() must have exactly 2 arguments, one for texture, the other for the coordinates")
            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of textureLoad() must be a texture object that's visible in kernel scope")
            let texture = argumentValues[0].hostSideValue as TextureBase
            let dim = texture.getTextureDimensionality()

            let coords = argumentValues[1]
            this.assertNode(node, coords.getType().getCategory() === TypeCategory.Vector, "coords must be a vector")
            let vecType = coords.getType() as VectorType
            let requiredComponentCount = getTextureCoordsNumComponents(dim)
            this.assertNode(node, vecType.getNumRows() === requiredComponentCount, `coords component count must be ${requiredComponentCount}`)
            this.assertNode(node, vecType.getPrimitiveType() === PrimitiveType.i32, "coords must be a i32 vector")

            let sampleResultStmt = this.irBuilder.create_texture_load(texture, coords.stmts.slice())

            let resultType = new VectorType(PrimitiveType.f32, 4)
            let result = new Value(resultType)
            for (let i = 0; i < 4; ++i) {
                result.stmts.push(this.irBuilder.create_composite_extract(sampleResultStmt, i))
            }
            return result
        }

        if (this.isBuiltinFunctionWithName(funcText, "textureStore")) {
            this.assertNode(node, node.arguments.length === 3, "textureStore() must have exactly 3 arguments, one for texture, one for the coordinates, and one for the texel value")
            this.assertNode(node, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && isTexture(argumentValues[0].hostSideValue), "the first argument of textureStore() must be a texture object that's visible in kernel scope")
            let texture = argumentValues[0].hostSideValue as TextureBase
            let dim = texture.getTextureDimensionality()

            let coords = argumentValues[1]
            this.assertNode(node, coords.getType().getCategory() === TypeCategory.Vector, "coords must be a vector")
            let coordsVecType = coords.getType() as VectorType
            let requiredComponentCount = getTextureCoordsNumComponents(dim)
            this.assertNode(node, coordsVecType.getNumRows() === requiredComponentCount, `coords component count must be ${requiredComponentCount}`)
            this.assertNode(node, coordsVecType.getPrimitiveType() === PrimitiveType.i32, "coords must be a i32 vector")

            let value = argumentValues[2]
            this.assertNode(node, value.getType().getCategory() === TypeCategory.Vector, "coords must be a vector")
            let valueVecType = value.getType() as VectorType
            this.assertNode(node, valueVecType.getNumRows() === 4, `value component count must be 4`)
            this.assertNode(node, valueVecType.getPrimitiveType() === PrimitiveType.f32, "value must be a f32 vector")

            this.irBuilder.create_texture_store(texture, coords.stmts, value.stmts)
            return
        }
        if (this.isBuiltinFunctionWithName(funcText, "getVertexIndex")) {
            let resultType = new ScalarType(PrimitiveType.i32)
            let result = new Value(resultType)
            result.stmts.push(this.irBuilder.create_vertex_index_input())
            return result
        }
        if (this.isBuiltinFunctionWithName(funcText, "getInstanceIndex")) {
            let resultType = new ScalarType(PrimitiveType.i32)
            let result = new Value(resultType)
            result.stmts.push(this.irBuilder.create_instance_index_input())
            return result
        }
        if (this.isBuiltinFunctionWithName(funcText, "dpdx") || this.isBuiltinFunctionWithName(funcText, "dpdy")) {
            this.assertNode(node, node.arguments.length === 1, "dpdx()/dpdy() must have exactly 1 argument")
            let val = argumentValues[0]
            let valType = val.getType()
            this.assertNode(node, TypeUtils.isTensorType(valType) && TypeUtils.getPrimitiveType(valType) === PrimitiveType.f32, "dpdx()/dpdy() must accept a f32 scalar/vector/matrix argument")
            let result = new Value(valType)
            for (let stmt of val.stmts) {
                let derivative: FragmentDerivativeStmt
                if (this.isBuiltinFunctionWithName(funcText, "dpdx")) {
                    derivative = this.irBuilder.create_dpdx(stmt)
                }
                else {
                    derivative = this.irBuilder.create_dpdy(stmt)
                }
                result.stmts.push(derivative)
            }
            return result
        }
    }

    protected override visitCallExpression(node: ts.CallExpression): VisitorResult<Value> {
        let funcText = node.expression.getText()

        let checkNumArgs = (n: number) => {
            this.assertNode(node, node.arguments.length === n, funcText + " requires " + n.toString() + " args")
        }

        let rawArgumentValues: Value[] = []
        for (let arg of node.arguments) {
            let argVal = this.extractVisitorResult(this.dispatchVisit(arg))
            rawArgumentValues.push(argVal)
        }

        // lazily evaluated. pointer for l-values, newly created alloca copies for r-values
        let argumentRefs: Value[] | null = null
        let getArgumentRefs = (): Value[] => {
            if (argumentRefs !== null) {
                return argumentRefs
            }
            argumentRefs = []
            for (let rawVal of rawArgumentValues) {
                if (rawVal.getType().getCategory() === TypeCategory.Pointer) {
                    argumentRefs.push(rawVal)
                }
                else if (rawVal.getType().getCategory() === TypeCategory.Function || rawVal.getType().getCategory() === TypeCategory.HostObjectReference) {
                    // cannot create alloca for these types
                    argumentRefs.push(rawVal)
                }
                else {
                    // passing r value. Create a local var copy, so that it can be assigned in the func
                    let copy = this.createLocalVarCopy(rawVal)
                    argumentRefs.push(copy)
                }
            }
            return argumentRefs
        }

        // lazily evaluated. r-values
        let argumentValues: Value[] | null = null
        let getArgumentValues = (): Value[] => {
            if (argumentValues !== null) {
                return argumentValues
            }
            argumentValues = []
            for (let i = 0; i < node.arguments.length; ++i) {
                if (rawArgumentValues[i].getType().getCategory() === TypeCategory.Pointer) {
                    argumentValues.push(this.derefIfPointer(getArgumentRefs()[i]))
                }
                else {
                    argumentValues.push(rawArgumentValues[i])
                }
            }
            return argumentValues
        }

        // Library funcs
        let libraryFuncs = LibraryFunc.getLibraryFuncs()
        for (let kv of libraryFuncs) {
            let func = kv[1]
            if (this.isBuiltinFunctionWithName(funcText, func.name)) {
                let compiler = new InliningCompiler(this.irBuilder, this.builtinOps, this.atomicOps, funcText)
                let parsedInlinedFunction = ParsedFunction.makeFromCode(func.code)
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
            if (this.isBuiltinMathFunctionWithName(funcText, op.name)) {
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
            if (this.isBuiltinFunctionWithName(funcText, op.name)) {
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

        if (this.isRenderingBuiltinFunction(funcText)) {
            return this.handleRenderingBuiltinFunction(funcText, getArgumentValues(), node)
        }

        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let access = node.expression as ts.PropertyAccessExpression
            let obj = access.expression
            let prop = access.name
            let illegalNames = ["taichi", "ti", "Math"]
            for (let name of illegalNames) {
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

        let calledFunctionValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        if (calledFunctionValue.getType().getCategory() === TypeCategory.Function) {
            let compiler = new InliningCompiler(this.irBuilder, this.builtinOps, this.atomicOps, funcText)
            let additionalSymbolTable: SymbolTable | null = null
            this.assertNode(node, calledFunctionValue.hostSideValue instanceof ParsedFunction, "[Compiler Bug] could not find parsed function")
            let parsedFunction = calledFunctionValue.hostSideValue as ParsedFunction
            if (parsedFunction.tsProgram === this.parsedFunction!.tsProgram) {
                // this means that the funtion is embedded in this kernel/function. 
                // so we should pass in this function's symbol table, to allow variable captures
                additionalSymbolTable = this.symbolTable
            }
            let result = compiler.runInlining(parsedFunction, this.kernelScope, getArgumentRefs(), additionalSymbolTable)
            if (result) {
                return result
            }
            return
        }

        this.errorNode(node, "unresolved function call: " + funcText)
    }

    protected override visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value> {
        let base = node.expression
        let argument = node.argumentExpression

        let baseValue = this.extractVisitorResult(this.dispatchVisit(base))
        let argumentValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(argument)))
        let baseType = baseValue.getType()
        let argType = argumentValue.getType()
        this.assertNode(node, argType.getCategory() === TypeCategory.Scalar || argType.getCategory() === TypeCategory.Vector, "index must be scalar or vector")

        if (baseType.getCategory() === TypeCategory.HostObjectReference) {
            if (baseValue.hostSideValue instanceof Field) {
                let field = baseValue.hostSideValue as Field
                let result = new Value(new PointerType(field.elementType, true), [])

                this.assertNode(node, TypeUtils.isTensorType(argType), "invalid field index")

                this.assertNode(node, argumentValue.stmts.length === field.dimensions.length,
                    `field access dimension mismatch, received ${argumentValue.stmts.length} components, but expecting ${field.dimensions.length} components`)

                for (let i = 0; i < field.elementType.getPrimitivesList().length; ++i) {
                    let ptr = this.irBuilder.create_global_ptr(field, argumentValue.stmts.slice(), i);
                    result.stmts.push(ptr)
                }
                return result
            }
            if (Array.isArray(baseValue.hostSideValue)) {
                this.assertNode(node, argumentValue.isCompileTimeConstant(), `index for accessing a host-side array must be compile-time evaluable. Bad index: ${node.argumentExpression.getText()}`)
                this.assertNode(node, argType.getPrimitivesList().length === 1, "can only use 1D access on host-side arrays")
                let element = baseValue.hostSideValue[argumentValue.compileTimeConstants[0]]
                return this.getValueFromAnyHostValue(element)
            }
        }

        this.assertNode(node, argumentValue.isCompileTimeConstant(), "Indices of vectors/matrices must be a compile-time constant")
        this.assertNode(node, TypeUtils.getPrimitiveType(argType) === PrimitiveType.i32, "Indices of be of i32 type")

        if (TypeUtils.isValueOrPointerOfCategory(baseType, TypeCategory.Vector)) {
            this.assertNode(node, argType.getPrimitivesList().length === 1, "index for a vector must have only 1 component")
            let components = ValueUtils.getVectorComponents(baseValue)
            return components[argumentValue.compileTimeConstants[0]]
        }
        else if (TypeUtils.isValueOrPointerOfCategory(baseType, TypeCategory.Matrix)) {
            if (argType.getCategory() === TypeCategory.Vector) {
                let argVecType = argType as VectorType
                this.assertNode(node, argVecType.getNumRows() === 2, "a vector index of matrix have exactly two components")
                let components = ValueUtils.getMatrixComponents(baseValue)
                return components[argumentValue.compileTimeConstants[0]][argumentValue.compileTimeConstants[1]]
            }
            else if (argType.getCategory() === TypeCategory.Scalar) {
                let rows = ValueUtils.getMatrixRowVectors(baseValue)
                return rows[argumentValue.compileTimeConstants[0]]
            }
        }
        else {
            this.errorNode(node, "only vectors, matrices, and JS-scope arrays can be indexed")
        }
    }

    protected override visitPropertyAccessExpression(node: ts.PropertyAccessExpression): VisitorResult<Value> {
        if (this.canEvalInKernelScopeOrTemplateArgs(node)) {
            let hostResult = this.tryEvalInKernelScopeOrTemplateArgs(node)
            let value = this.getValueFromAnyHostValue(hostResult)
            return value
        }
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
        else if (objRef.getType().getCategory() === TypeCategory.HostObjectReference) {
            let objHostValue = objRef.hostSideValue
            if (typeof objHostValue === "object" && objHostValue && propText in objHostValue) {
                return this.getValueFromAnyHostValue(objHostValue[propText])
            }
        }
        this.errorNode(node, `invalid property access: ${node.getText()}`)
    }

    protected getValueFromAnyHostValue(val: any): Value {
        // returns a value if successful, otherwise returns an error msg
        let tryGetValue = (val: any, recursionDepth: number): Value | string => {
            if (recursionDepth > 1024) {
                return "The object is too big to be evaluated in kernel scope (or it might has a circular reference structure)."
            }
            if (typeof val === "number") {
                if (val % 1 === 0) {
                    return ValueUtils.makeConstantScalar(val, this.irBuilder.get_int32(val), PrimitiveType.i32)
                }
                else {
                    return ValueUtils.makeConstantScalar(val, this.irBuilder.get_float32(val), PrimitiveType.f32)
                }
            }
            else if (typeof val === "boolean") {
                if (val) {
                    return ValueUtils.makeConstantScalar(1, this.irBuilder.get_int32(1), PrimitiveType.i32)
                }
                else {
                    return ValueUtils.makeConstantScalar(0, this.irBuilder.get_int32(0), PrimitiveType.i32)
                }
            }
            else if (typeof val === "function") {
                if (recursionDepth !== 0) {
                    return "calling member functions are not supported"
                }
                let parsedFunction = ParsedFunction.makeFromCode(val.toString())
                let value = new Value(new FunctionType())
                value.hostSideValue = parsedFunction
                return value
            }
            else if (typeof val === "string") {
                if (recursionDepth !== 0) {
                    return " member functions / strings are not supported"
                }
                let parsedFunction = ParsedFunction.makeFromCode(val)
                let value = new Value(new FunctionType())
                value.hostSideValue = parsedFunction
                return value
            }
            else if (isHostSideVectorOrMatrix(val)) {
                let result = tryGetValue(val[0], recursionDepth + 1)
                if (typeof result === "string") {
                    return result
                }
                if (val.length === 1) {
                    if (result!.getType().getCategory() === TypeCategory.Scalar) {
                        return ValueUtils.makeVectorFromScalars([result!])
                    }
                    else if (result!.getType().getCategory() === TypeCategory.Vector) {
                        return ValueUtils.makeMatrixFromVectorsAsRows([result!])
                    }
                    else {
                        return "can only use arrays of scalars or vectors"
                    }
                }
                for (let i = 1; i < val.length; ++i) {
                    let thisValue = tryGetValue(val[i], recursionDepth + 1)
                    if (typeof thisValue === "string") {
                        return thisValue
                    }
                    result = this.comma(result, thisValue)
                }
                return result
            }
            else if (isPlainOldData(val) && typeof val === "object" && !Array.isArray(val)) {
                let valuesMap = new Map<string, Value>()
                let keys = Object.keys(val)
                for (let k of keys) {
                    let propVal = tryGetValue(val[k], recursionDepth + 1)
                    if (typeof propVal === "string") {
                        return propVal
                    }
                    valuesMap.set(k, propVal)
                }
                return ValueUtils.makeStruct(keys, valuesMap)
            }
            else if (val instanceof Field || isTexture(val) || val === null || val === undefined) {
                return ValueUtils.makeHostObjectReference(val)
            }
            else {
                return "cannot evaluate"
            }
        }
        let maybeValue = tryGetValue(val, 0);
        if (typeof maybeValue === "string") {
            // tryGetValue failed.
            // fallback to a HostObjectReference
            return ValueUtils.makeHostObjectReference(val)
        }
        return maybeValue
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<Value> {
        if (this.hasNodeSymbol(node)) {
            let symbol = this.getNodeSymbol(node)
            if (this.symbolTable.has(symbol)) {
                return this.symbolTable.get(symbol)
            }
        }
        if (this.canEvalInKernelScopeOrTemplateArgs(node)) {
            let hostSideValue = this.tryEvalInKernelScopeOrTemplateArgs(node)
            let value = this.getValueFromAnyHostValue(hostSideValue)
            return value
        }
        if (node.getText() === "undefined") {
            return ValueUtils.makeHostObjectReference(undefined)
        }
        if (node.getText() === "null") {
            return ValueUtils.makeHostObjectReference(null)
        }
        this.errorNode(node, "unresolved identifier: " + node.getText())
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value> {
        let identifier = node.name
        if (!node.initializer) {
            this.errorNode(node, "variable declaration must have an identifier")
        }
        let illegalNames = ["taichi", "ti", "Math", "null", "undefined"]
        for (let name of illegalNames) {
            if (name === node.name.getText() || name.indexOf("$") !== -1) {
                this.errorNode(node, name + " cannot be used as a local variable name")
            }
        }

        let initializer = node.initializer!
        let initValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(initializer)))
        let varSymbol = this.getNodeSymbol(identifier)

        if (initValue.getType().getCategory() !== TypeCategory.Function && initValue.getType().getCategory() !== TypeCategory.HostObjectReference) {
            let localVar = this.createLocalVarCopy(initValue)
            this.symbolTable.set(varSymbol, localVar)
            return localVar
        }
        else {
            // don't support alloca/load/store for functions and host object references... treated as const
            this.symbolTable.set(varSymbol, initValue)
            return initValue
        }
    }

    protected override visitIfStatement(node: ts.IfStatement): VisitorResult<Value> {
        let condValue = this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(node.expression)))
        this.assertNode(node, condValue.getType().getCategory() === TypeCategory.Scalar, "condition of if statement must be scalar")
        let isStaticIf = false
        if (node.expression.kind === ts.SyntaxKind.CallExpression) {
            let callExpr = node.expression as ts.CallExpression
            let funcText = callExpr.expression.getText()
            if (this.isBuiltinFunctionWithName(funcText, "static")) {
                isStaticIf = true
            }
        }
        if (isStaticIf) {
            this.assertNode(node, condValue.isCompileTimeConstant(), "if(ti.static(...)) requires a compile-time constant condition")
            let cond = condValue.compileTimeConstants[0]
            if (cond !== 0) {
                this.dispatchVisit(node.thenStatement)
            }
            else {
                if (node.elseStatement) {
                    this.dispatchVisit(node.elseStatement)
                }
            }
        }
        else {
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

    protected shouldStrictlySerialize() {
        return false
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
            let loop = this.irBuilder.create_range_for(rangeLengthValue.stmts[0], this.shouldStrictlySerialize());

            let loopGuard = this.irBuilder.get_range_loop_guard(loop);
            let indexStmt = this.irBuilder.get_loop_index(loop);
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
            let loop = this.irBuilder.create_range_for(product, this.shouldStrictlySerialize());

            let loopGuard = this.irBuilder.get_range_loop_guard(loop);
            let flatIndexStmt: Stmt = this.irBuilder.get_loop_index(loop);

            let indexType = new VectorType(PrimitiveType.i32, numDimensions)
            let indexValue = new Value(indexType, [])
            let remainder = flatIndexStmt

            for (let i = numDimensions - 1; i >= 0; --i) {
                let thisDimStmt = lengthValues[i].stmts[0]
                let thisIndex = this.irBuilder.create_mod(remainder, thisDimStmt)
                indexValue.stmts = ([thisIndex] as Stmt[]).concat(indexValue.stmts)
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

    protected isInVertexOrFragmentFor() {
        return (this.startedVertex && !this.finishedVertex) || this.startedFragment
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
        return this.isBuiltinFunctionWithName(calledFunctionText, "inputFragments")
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
        this.ensureRenderPassParams()
        if (vertexArgs.length === 0) {
            this.errorNode(null, "Expecting vertex buffer and optionally index buffer")
        }
        let argumentValues: Value[] = vertexArgs.map((expr: ts.Expression) => this.derefIfPointer(this.extractVisitorResult(this.dispatchVisit(expr))))
        if (argumentValues.length >= 1) {
            this.assertNode(null, argumentValues[0].getType().getCategory() === TypeCategory.HostObjectReference && argumentValues[0].hostSideValue instanceof Field, `the vertex buffer ${vertexArgs[0].getText()} must be an instance of taichi field that's visible in kernel scope`)
            let vertexBuffer = argumentValues[0].hostSideValue as Field
            this.assertNode(null, vertexBuffer.dimensions.length === 1, "the vertex buffer must be a 1D field ")
            this.currentRenderPipelineParams.vertexBuffer = vertexBuffer
        }
        if (argumentValues.length >= 2) {
            this.assertNode(null, argumentValues[1].getType().getCategory() === TypeCategory.HostObjectReference && argumentValues[1].hostSideValue instanceof Field, `the index buffer ${vertexArgs[0].getText()} must be an instance of taichi field that's visible in kernel scope`)
            let indexBuffer = argumentValues[1].hostSideValue as Field
            this.assertNode(null, indexBuffer.dimensions.length === 1 && indexBuffer.elementType.getCategory() === TypeCategory.Scalar && TypeUtils.getPrimitiveType(indexBuffer.elementType) === PrimitiveType.i32, "the index buffer must be a 1D field of i32 scalars")
            this.currentRenderPipelineParams.indexBuffer = indexBuffer
        }
        if (vertexArgs.length >= 3) {
            this.assertNode(null, argumentValues[2].getType().getCategory() === TypeCategory.HostObjectReference && argumentValues[2].hostSideValue instanceof Field, `the indirect buffer ${vertexArgs[0].getText()} must be an instance of taichi field that's visible in kernel scope`)
            let indirectBuffer = argumentValues[2].hostSideValue as Field
            this.assertNode(null, indirectBuffer.dimensions.length === 1, "the indirect buffer must be a 1D field ")
            this.currentRenderPipelineParams.indirectBuffer = indirectBuffer
        }
        if (vertexArgs.length >= 4) {
            this.assertNode(null, argumentValues[3].getType().getCategory() === TypeCategory.Scalar && TypeUtils.getPrimitiveType(argumentValues[3].getType()) == PrimitiveType.i32, `the indirect count must be a i32 scalar`)
            if (argumentValues[3].isCompileTimeConstant()) {
                this.currentRenderPipelineParams.indirectCount = argumentValues[3].compileTimeConstants[0]
            }
            else {
                this.currentRenderPipelineParams.indirectCount = FieldFactory.createField(new ScalarType(PrimitiveType.i32), [1])
                Program.getCurrentProgram().materializeCurrentTree()

                let ptr = this.irBuilder.create_global_ptr(this.currentRenderPipelineParams.indirectCount, [this.irBuilder.get_int32(0)], 0)
                this.irBuilder.create_global_store(ptr, argumentValues[3].stmts[0])
            }
        }
        if (vertexArgs.length >= 5) {
            this.errorNode(null, "Expecting up to 4 arguments (vertex buffer, index buffer, indirect buffer, indirect count) in inputVertices")
        }
        let loop = this.irBuilder.create_vertex_for();

        let loopGuard = this.irBuilder.get_vertex_loop_guard(loop);
        this.loopStack.push(LoopKind.VertexFor);

        let vertexType = this.currentRenderPipelineParams.vertexBuffer!.elementType
        let vertexInputValue = new Value(vertexType, [])
        let prims = vertexType.getPrimitivesList()
        for (let i = 0; i < prims.length; ++i) {
            let stmt = this.irBuilder.create_vertex_input(i, prims[i])
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
            this.errorNode(null, "Expecting no arguments in inputFragments()")
        }

        let loop = this.irBuilder.create_fragment_for();

        let loopGuard = this.irBuilder.get_fragment_loop_guard(loop);
        this.loopStack.push(LoopKind.FragmentFor);

        this.assertNode(null, this.currentRenderPipelineParams!.interpolatedType !== null, "[Compiler bug]")

        let fragmentType = this.currentRenderPipelineParams!.interpolatedType!
        let fragmentInputValue = new Value(fragmentType, [])
        let prims = fragmentType.getPrimitivesList()
        for (let i = 0; i < prims.length; ++i) {
            let stmt = this.irBuilder.create_fragment_input(i, prims[i])
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
            if (this.isBuiltinFunctionWithName(calledFunctionText, "range")) {
                return this.visitRangeFor(loopIndexSymbols, callExpr.arguments, node.statement, false)
            }
            else if (this.isBuiltinFunctionWithName(calledFunctionText, "ndrange")) {
                return this.visitNdrangeFor(loopIndexSymbols, callExpr.arguments, node.statement, false)
            }
            else if (this.isBuiltinFunctionWithName(calledFunctionText, "inputVertices")) {
                return this.visitVertexFor(loopIndexSymbols, callExpr.arguments, node.statement)
            }
            else if (this.isBuiltinFunctionWithName(calledFunctionText, "inputFragments")) {
                return this.visitFragmentFor(loopIndexSymbols, callExpr.arguments, node.statement)
            }
            else if (this.isBuiltinFunctionWithName(calledFunctionText, "static")) {
                let errMsg = "expecting a single range(...) or ndrange(...) within static(...)"
                this.assertNode(node, callExpr.arguments.length === 1, errMsg)
                let innerExpr = callExpr.arguments[0]
                this.assertNode(node, innerExpr.kind === ts.SyntaxKind.CallExpression, errMsg)
                let innerCallExpr = innerExpr as ts.CallExpression
                let innerCallText = innerCallExpr.expression.getText()
                if (this.isBuiltinFunctionWithName(innerCallText, "range")) {
                    return this.visitRangeFor(loopIndexSymbols, innerCallExpr.arguments, node.statement, true)
                }
                else if (this.isBuiltinFunctionWithName(innerCallText, "ndrange")) {
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

    protected override visitFunctionDeclaration(node: ts.FunctionDeclaration): VisitorResult<Value> {
        let value = new Value(new FunctionType())
        value.hostSideValue = ParsedFunction.makeFromParsedNode(node, this.parsedFunction!)
        if (node.name) {
            this.symbolTable.set(this.getNodeSymbol(node.name), value)
        }
        return value
    }

    protected override visitArrowFunction(node: ts.ArrowFunction): VisitorResult<Value> {
        let value = new Value(new FunctionType())
        value.hostSideValue = ParsedFunction.makeFromParsedNode(node, this.parsedFunction!)
        return value
    }

    protected override visitThisKeyword(): VisitorResult<Value> {
        return ValueUtils.makeHostObjectReference(this.kernelScope.thisObj)
    }

    protected override visitNonNullExpression(node: ts.NonNullExpression): VisitorResult<Value> {
        return this.extractVisitorResult(this.dispatchVisit(node.expression))
    }

    protected override visitAsExpression(node: ts.AsExpression): VisitorResult<Value> {
        return this.extractVisitorResult(this.dispatchVisit(node.expression))
    }

    protected override visitUnknown(node: ts.Node): VisitorResult<Value> {
        this.errorNode(node, "Unsupported JS language construct")
    }
}

export class InliningCompiler extends CompilingVisitor {
    constructor(
        irBuilder: IRBuilder,
        builtinOps: Map<string, BuiltinOp>,
        atomicOps: Map<string, BuiltinAtomicOp>,
        public funcName: string) {
        super(irBuilder, builtinOps, atomicOps)
    }

    argValues: Value[] = []

    runInlining(parsedFunction: ParsedFunction, kernelScope: Scope, argValues: Value[], parentFunctionSymbolTable: SymbolTable | null = null): Value | null {
        this.argValues = argValues
        if (parentFunctionSymbolTable !== null) {
            for (let symbol of parentFunctionSymbolTable.keys()) {
                let val = parentFunctionSymbolTable.get(symbol)!
                this.symbolTable.set(symbol, val)
            }
        }
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

    protected shouldStrictlySerialize() {
        // avoid generating an overloaded task due to a for loop inside a function
        return true
    }
}
export class KernelCompiler extends CompilingVisitor {
    constructor() {
        let irBuilder = new IRBuilder()
        let builtinOps = BuiltinOpFactory.getBuiltinOps(irBuilder)
        let atomicOps = BuiltinOpFactory.getAtomicOps(irBuilder)

        super(irBuilder, builtinOps, atomicOps)

        this.kernelArgTypes = []
        this.argTypesMap = new Map<string, Type>()
        this.templateArgumentValues = null
    }

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

        let irModule = this.irBuilder.module
        console.log("initial IR\n", stringifyIR(irModule))
        identifyParallelLoops(irModule)
        console.log("identified parallel loops\n", stringifyIR(irModule))
        insertGlobalTemporaries(irModule)
        console.log("global temps\n", stringifyIR(irModule))
        demoteAtomics(irModule)
        console.log("demoted atomics\n", stringifyIR(irModule))
        let offloadedModules = offload(irModule)
        console.log("offloaded\n")
        for (let o of offloadedModules) {
            console.log(stringifyIR(o))
        }

        let argBytes = 0
        for (let t of this.kernelArgTypes) {
            argBytes += t.getPrimitivesList().length * 4
        }

        let returnBytes = 0
        let returnType = new VoidType()
        if (this.returnValue !== null) {
            returnType = this.returnValue!.getType()
            returnBytes = returnType.getPrimitivesList().length
        }

        let taskParams: (TaskParams | RenderPipelineParams)[] = []
        let currentRenderPipelineParamsId = 0

        for (let offload of offloadedModules) {
            let bindingPointBegin = 0
            if (offload.type === OffloadType.Fragment) {
                bindingPointBegin = this.renderPipelineParams[currentRenderPipelineParamsId].vertex.bindings.length
            }
            let codegen = new CodegenVisitor(Program.getCurrentProgram().runtime!, offload, argBytes, returnBytes, bindingPointBegin)
            let params = codegen.generate()
            console.log(params.code)
            switch (offload.type) {
                case OffloadType.Serial:
                case OffloadType.Compute: {
                    taskParams.push(params as TaskParams)
                    break
                }
                case OffloadType.Vertex: {
                    let pipeline = this.renderPipelineParams[currentRenderPipelineParamsId]
                    this.checkGraphicsShaderBindings(params.bindings)
                    pipeline.vertex = params as VertexShaderParams
                    break
                }
                case OffloadType.Fragment: {
                    let pipeline = this.renderPipelineParams[currentRenderPipelineParamsId]
                    this.checkGraphicsShaderBindings(params.bindings)
                    pipeline.fragment = params as FragmentShaderParams
                    pipeline.bindings = pipeline.getBindings()
                    taskParams.push(pipeline)
                    currentRenderPipelineParamsId++;
                    break
                }
                default: {
                    error("unrecgnized offload type")
                }
            }
        }

        return new KernelParams(taskParams, this.kernelArgTypes, returnType, this.renderPassParams)
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
                val.stmts.push(this.irBuilder.create_arg_load(prim, argStmtId++))
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
            this.irBuilder.create_return_vec(this.returnValue.stmts.slice())
        }
        else {
            this.returnValue = new Value(new VoidType())
            this.irBuilder.create_return_vec(this.returnValue.stmts)
        }
    }

    protected checkGraphicsShaderBindings(bindings: ResourceBinding[]) {
        for (let binding of bindings) {
            if (binding.info.resourceType === ResourceType.RandStates) {
                error("vertex and fragment shaders are not allowed to use randoms")
            }
            else if (binding.info.resourceType === ResourceType.Rets) {
                error("[Compiler Bug] vertex and fragment shaders are not allowed to use rets")
            }
            else if (binding.info.resourceType === ResourceType.RootAtomic) {
                error("vertex and fragment shaders are not allowed to use atomics")
            }
            else if (binding.info.resourceType === ResourceType.Root) {
                let id = binding.info.resourceID!
                if (Program.getCurrentProgram().runtime!.materializedTrees[id].size > 65536) {
                    // this is because vertex shaders are not allowed to use storage buffers, and fragment shader bindings must match the vertex shaders
                    // and uniform buffers have a size limit of 64kB
                    // not that in order for this error message to make sense, we must have one-to-one correspondence between fields and snode trees
                    error("vertex and fragment shaders are not allowed to use fields of size greater than 64kB")
                }
            }
        }
    }
}
