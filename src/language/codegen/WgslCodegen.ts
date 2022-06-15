import { DepthTexture, getTextureCoordsNumComponents, TextureDimensionality } from "../../data/Texture";
import { Program } from "../../program/Program";
import { ResourceBinding, ResourceInfo, ResourceType } from "../../runtime/Kernel";
import { Runtime } from "../../runtime/Runtime";
import { assert, error } from "../../utils/Logging";
import { divUp } from "../../utils/Utils";
import { PrimitiveType } from "../frontend/Type";
import { AllocaStmt, ArgLoadStmt, BinaryOpStmt, BinaryOpType, BuiltInInputKind, BuiltInInputStmt, BuiltInOutputKind, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, FragmentDerivativeDirection, FragmentDerivativeStmt, FragmentInputStmt, IfStmt, LocalLoadStmt, LocalStoreStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, TextureFunctionKind, TextureFunctionStmt, UnaryOpStmt, UnaryOpType, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "../ir/Stmt";
import { IRVisitor } from "../ir/Visitor";
import { OffloadedModule, OffloadType } from "./Offload";

export interface CodegenResult {
    code: string
}



class ResourceBindingMap {
    bindings: ResourceBinding[] = []
    has(resource: ResourceInfo) {
        for (let b of this.bindings) {
            if (b.info.equals(resource)) {
                return true
            }
        }
        return false
    }
    add(resource: ResourceInfo, bindingPoint: number) {
        let binding = new ResourceBinding(resource, bindingPoint)
        this.bindings.push(binding)
    }
    get(resource: ResourceInfo) {
        for (let b of this.bindings) {
            if (b.info.equals(resource)) {
                return b.binding!
            }
        }
        return undefined
    }
    size() {
        return this.bindings.length
    }
}

class StringBuilder {
    parts: string[] = []
    write(...args: (string | number)[]) {
        for (let a of args) {
            this.parts.push(a.toString())
        }
    }
    getString() {
        return this.parts.join()
    }
    empty() {
        return this.parts.length === 0
    }
}

class PointerInfo {
    isRoot: boolean = false
    rootId: number | null = null
}

export class CodegenVisitor extends IRVisitor {
    constructor(
        public runtime: Runtime,
        public offload: OffloadedModule,
        public argBytes: number,
        public retBytes: number,
        public bindingPointBegin = 0
    ) {
        super()
    }

    override visitConstStmt(stmt: ConstStmt): void {
        let dt = stmt.getReturnType()
        let val = stmt.val
        this.emitLet(stmt.getName(), this.getPrimitiveTypeName(dt))
        switch (dt) {
            case PrimitiveType.f32: {
                let s = val.toPrecision(8)
                if (!s.includes(".") && !s.includes("e") && !s.includes("E")) {
                    s += ".f"
                }
                this.body.write(s)
                break;
            }
            case PrimitiveType.i32: {
                assert(Number.isInteger(val), "expecting integer")
                this.body.write(val.toString())
                break;
            }
            default: {
                error("unrecognized return type ", stmt)
            }
        }
        this.body.write(";\n")
    }

    override visitRandStmt(stmt: RandStmt): void {
        this.initRand()
        this.emitLet(stmt.getName(), this.getPrimitiveTypeName(stmt.getReturnType()))
        switch (stmt.getReturnType()) {
            case PrimitiveType.i32: {
                this.body.write("rand_i32(gid3.x);\n");
                break;
            }
            case PrimitiveType.f32: {
                this.body.write("rand_f32(gid3.x);\n");
                break;
            }
            default: {
                error("unrecognized primitive type")
            }
        }
    }

    override visitUnaryOpStmt(stmt: UnaryOpStmt): void {
        let operand = stmt.getOperand().getName()
        let srcType = stmt.getOperand().getReturnType()
        let dstType = stmt.getReturnType()
        let dstTypeName = this.getPrimitiveTypeName(dstType)
        let op = stmt.op
        let getValue = (op: UnaryOpType) => {
            switch (op) {
                case UnaryOpType.neg: return `(-(${operand}))`
                case UnaryOpType.sqrt: return `sqrt(f32(${operand}))`
                case UnaryOpType.round: return `round(f32(${operand}))`
                case UnaryOpType.floor: return `floor(f32(${operand}))`
                case UnaryOpType.ceil: return `ceil(f32(${operand}))`
                case UnaryOpType.cast_i32_value: return `i32(${operand})`
                case UnaryOpType.cast_f32_value: return `f32(${operand})`
                case UnaryOpType.cast_i32_bits: return `bitcast<i32>(${operand})`
                case UnaryOpType.cast_f32_bits: return `bitcast<f32>(${operand})`
                case UnaryOpType.abs: return `abs(${operand})`
                case UnaryOpType.sgn: return `sign(${operand})`
                case UnaryOpType.sin: return `sin(f32(${operand}))`
                case UnaryOpType.asin: return `asin(f32(${operand}))`
                case UnaryOpType.cos: return `cos(f32(${operand}))`
                case UnaryOpType.acos: return `acos(f32(${operand}))`
                case UnaryOpType.tan: return `tan(f32(${operand}))`
                case UnaryOpType.tanh: return `tanh(f32(${operand}))`
                case UnaryOpType.inv: return `1.f / f32(${operand})`
                case UnaryOpType.rcp: return `1.f / f32(${operand})`
                case UnaryOpType.exp: return `exp(f32(${operand}))`
                case UnaryOpType.log: return `log(f32(${operand}))`
                case UnaryOpType.rsqrt: return `inverseSqrt(f32(${operand}))`
                case UnaryOpType.logic_not: {
                    let zero = "0"
                    switch (srcType) {
                        case PrimitiveType.f32: {
                            zero = "0.f";
                            break;
                        }
                        case PrimitiveType.i32: {
                            zero = "0";
                            break;
                        }
                        default:
                            error("unexpected prim type")
                    }
                    return `i32(${operand} == ${zero})`
                }
                case UnaryOpType.logic_not: {
                    return `(~(${operand}))`
                }
                default: {
                    error("unhandled unary op")
                    return "error"
                }
            }
        }
        let value = getValue(op)!
        this.emitLet(stmt.getName(), dstTypeName)
        this.body.write(`${dstType}(${value});\n`);
    }

    override visitBinaryOpStmt(stmt: BinaryOpStmt): void {
        let lhs = stmt.getLeft().getName()
        let rhs = stmt.getRight().getName()
        let op = stmt.op

        let getValue = () => {
            switch (op) {
                case BinaryOpType.mul: return `(${lhs} * ${rhs})`
                case BinaryOpType.add: return `(${lhs} + ${rhs})`
                case BinaryOpType.sub: return `(${lhs} - ${rhs})`
                case BinaryOpType.truediv: return `(f32(${lhs}) / f32(${rhs}))`
                case BinaryOpType.floordiv: return `i32(${lhs} / ${rhs})`
                case BinaryOpType.div: return `(${lhs} / ${rhs})`
                case BinaryOpType.mod: return `(${lhs} % ${rhs})`
                case BinaryOpType.max: return `max(${lhs}, ${rhs})`
                case BinaryOpType.min: return `min(${lhs}, ${rhs})`
                case BinaryOpType.bit_and: return `(${lhs} & ${rhs})`
                case BinaryOpType.bit_or: return `(${lhs} | ${rhs})`
                case BinaryOpType.bit_xor: return `(${lhs} ^ ${rhs})`
                case BinaryOpType.bit_shl: return `(${lhs} << u32(${rhs}))`
                case BinaryOpType.bit_shr: return `(${lhs} >> u32(${rhs}))`
                case BinaryOpType.bit_sar: return `(${lhs} >> u32(${rhs}))`
                case BinaryOpType.cmp_lt: return `(${lhs} < ${rhs})`
                case BinaryOpType.cmp_le: return `(${lhs} <= ${rhs})`
                case BinaryOpType.cmp_gt: return `(${lhs} > ${rhs})`
                case BinaryOpType.cmp_ge: return `(${lhs} >= ${rhs})`
                case BinaryOpType.cmp_eq: return `(${lhs} == ${rhs})`
                case BinaryOpType.cmp_ne: return `(${lhs} != ${rhs})`
                case BinaryOpType.atan2: return `atan2(f32(${lhs}), f32(${rhs}))`
                case BinaryOpType.pow: return `pow(${lhs}, ${rhs})`
                case BinaryOpType.logical_or: return `(${lhs} | ${rhs})`
                case BinaryOpType.logical_and: return `(${lhs} & ${rhs})`
            }
        }
        let value = getValue()
        let dt = this.getPrimitiveTypeName(stmt.getReturnType())
        this.emitLet(stmt.getName(), dt)
        this.body.write(`${dt}(${value});\n`)
    }

    override visitRangeForStmt(stmt: RangeForStmt): void {
        this.emitVar(stmt.getName(), "i32")
        this.body.write("0;\n");
        this.body.write(this.getIndentation(), "loop {\n")
        this.indent()
        this.body.write(this.getIndentation(), `if (${stmt.getName()} >= ${stmt.getRange().getName()}) { break; }`)

        this.visitBlock(stmt.body)

        this.body.write(this.getIndentation(), `${stmt.getName()} = ${stmt.getName()} + 1;\n`);
        this.dedent()
        this.body.write(this.getIndentation(), "}\n")
    }

    override visitIfStmt(stmt: IfStmt): void {
        this.body.write(this.getIndentation(), `if (bool(${stmt.getCondition()})) {\n`)
        this.indent()
        this.visitBlock(stmt.trueBranch)
        this.dedent()
        this.body.write(this.getIndentation(), "}\n");

        this.body.write(this.getIndentation(), `else {\n`)
        this.indent()
        this.visitBlock(stmt.falseBranch)
        this.dedent()
        this.body.write(this.getIndentation(), "}\n");
    }

    override visitWhileControlStmt(stmt: WhileControlStmt): void {
        this.body.write(this.getIndentation(), "break;\n");
    }

    override visitContinueStmt(stmt: ContinueStmt): void {
        if (stmt.parentBlock === this.offload.block) {
            // then this parallel task is done;
            this.body.write(this.getIndentation(), "ii = ii + total_invocs;\n");
            // continue in grid-strided loop;
            this.body.write(this.getIndentation(), "continue;\n");
        }
        else {
            this.body.write(this.getIndentation(), "continue;\n");
        }
    }

    override visitWhileStmt(stmt: WhileStmt): void {
        this.body.write(this.getIndentation(), `loop {\n`)
        this.indent()
        this.visitBlock(stmt.body)
        this.dedent()
        this.body.write(this.getIndentation(), "}\n");
    }

    override visitVertexInputStmt(stmt: VertexInputStmt): void {
        let loc = stmt.location
        let dtName = this.getPrimitiveTypeName(stmt.getReturnType())
        let inputName = `in_${loc}_${dtName}`
        this.ensureStageInStruct()
        let flat = stmt.getReturnType() == PrimitiveType.i32
        this.addStageInMember(inputName, dtName, loc, flat)
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`stage_input.${inputName};\n`);
    }

    override visitFragmentInputStmt(stmt: FragmentInputStmt): void {
        let loc = stmt.location
        let dtName = this.getPrimitiveTypeName(stmt.getReturnType())
        let inputName = `in_${loc}_${dtName}`
        this.ensureStageInStruct()
        let flat = stmt.getReturnType() == PrimitiveType.i32
        this.addStageInMember(inputName, dtName, loc, flat)
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`stage_input.${inputName};\n`);
    }

    override visitVertexOutputStmt(stmt: VertexOutputStmt): void {
        let loc = stmt.location
        let dtName = this.getPrimitiveTypeName(stmt.getValue().getReturnType())
        let outputName = `out_${loc}_${dtName}`
        this.ensureStageOutStruct()
        let flat = stmt.getReturnType() == PrimitiveType.i32
        this.addStageOutMember(outputName, dtName, loc, flat)
        this.body.write(`stage_output.${outputName} = ${stmt.getValue().getName()};\n`);
    }

    override visitBuiltInOutputStmt(stmt: BuiltInOutputStmt): void {
        this.ensureStageOutStruct()
        let numComponents = stmt.getValues().length
        let primType = stmt.getValues()[0].getReturnType()
        let typeName = this.getScalarOrVectorTypeName(primType, numComponents)
        let outputExpr = this.getScalarOrVectorExpr(stmt.getValues(), typeName)
        let outputName = ""
        switch (stmt.builtinKind) {
            case BuiltInOutputKind.Color: {
                let loc = stmt.location!
                outputName = `color_${loc}`
                this.addStageOutMember(outputExpr, typeName, loc, false)
                break;
            }
            case BuiltInOutputKind.Position: {
                outputName = `position`
                this.addStageOutBuiltinMember(outputExpr, typeName, "position")
                break;
            }
            case BuiltInOutputKind.FragDepth: {
                outputName = `frag_depth`
                this.addStageOutBuiltinMember(outputExpr, typeName, "frag_depth")
                break;
            }
            default:
                error("unrecognized builtin kind")
        }
        this.body.write(this.getIndentation(), `stage_output.${outputName} = ${outputExpr};\n`);
    }

    override visitBuiltInInputStmt(stmt: BuiltInInputStmt): void {
        let dtName = this.getPrimitiveTypeName(stmt.getReturnType())
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`${dtName}(`)
        switch (stmt.builtinKind) {
            case BuiltInInputKind.VertexIndex: {
                this.body.write("vertex_index");
                break;
            }
            case BuiltInInputKind.InstanceIndex: {
                this.body.write("instance_index");
                break;
            }
            default:
                error("unrecognized builtin kind")
        }
        this.body.write(");\n")
    }

    override visitFragmentDerivativeStmt(stmt: FragmentDerivativeStmt): void {
        let dtName = this.getPrimitiveTypeName(stmt.getReturnType())
        this.emitLet(stmt.getName(), dtName)
        switch (stmt.direction) {
            case FragmentDerivativeDirection.x: {
                this.body.write("dpdxFine")
                break;
            }
            case FragmentDerivativeDirection.y: {
                this.body.write("dydxFine")
                break;
            }
            default:
                error("unrecognized direction")
        }
        this.body.write(`(${stmt.getName()});\n`)
    }

    override visitTextureFunctionStmt(stmt: TextureFunctionStmt): void {
        let texture = stmt.texture
        let textureResource = new ResourceInfo(ResourceType.Texture, texture.textureId)
        let requiresSampler = false

        switch (stmt.func) {
            case TextureFunctionKind.Sample: {
                requiresSampler = true
                break;
            }
            case TextureFunctionKind.SampleLod: {
                requiresSampler = true
                break;
            }
            case TextureFunctionKind.Load: {
                requiresSampler = false
                break;
            }
            case TextureFunctionKind.Store: {
                requiresSampler = false
                textureResource.resourceType = ResourceType.StorageTexture
                break;
            }
            default: {
                error("unrecognized texture func")
            }
        }
        let textureName = this.getTextureName(textureResource)
        let texelTypeName = this.getScalarOrVectorTypeName(PrimitiveType.f32, 4)

        let samplerName = ""
        if (requiresSampler) {
            let samplerResource = new ResourceInfo(ResourceType.Sampler, texture.textureId)
            samplerName = this.getSamplerName(samplerResource)
        }
        let coordsPrimType = stmt.getCoordinates()[0].getReturnType()
        let coordsComponentCount = getTextureCoordsNumComponents(texture.getTextureDimensionality())
        assert(coordsComponentCount === stmt.getCoordinates().length, "component count mismatch")
        let coordsTypeName = this.getScalarOrVectorTypeName(coordsPrimType, coordsComponentCount)

        let coordsExpr = this.getScalarOrVectorExpr(stmt.getCoordinates(), coordsTypeName)
        switch (stmt.func) {
            case TextureFunctionKind.Sample: {
                this.emitLet(stmt.getName(), texelTypeName)
                this.body.write(`textureSample(${textureName}, ${samplerName}, ${coordsExpr});\n`)
                break;
            }
            case TextureFunctionKind.SampleLod: {
                assert(stmt.getAdditionalOperands().length === 1, "expecting 1 lod value")
                this.emitLet(stmt.getName(), texelTypeName)
                this.body.write(`textureSampleLevel(${textureName}, ${samplerName}, ${coordsExpr}, ${stmt.getAdditionalOperands()[0].getName()});\n`)
                break;
            }
            case TextureFunctionKind.Load: {
                this.emitLet(stmt.getName(), texelTypeName)
                this.body.write(`textureLoad(${textureName}, ${coordsExpr}, 0);\n`)
                break;
            }
            case TextureFunctionKind.Store: {
                let valuePrimType = stmt.getAdditionalOperands()[0].getReturnType()
                let valueTypeName = this.getScalarOrVectorTypeName(valuePrimType, stmt.getAdditionalOperands().length)
                let valueExpr = this.getScalarOrVectorExpr(stmt.getAdditionalOperands(), valueTypeName)
                this.body.write(this.getIndentation(), `textureStore(${textureName}, ${coordsExpr}, ${valueExpr})`)
                break;
            }
            default: {
                error("unrecognized texture func")
            }
        }
    }

    override visitCompositeExtractStmt(stmt: CompositeExtractStmt): void {
        let typeName = this.getPrimitiveTypeName(stmt.getReturnType())
        this.emitLet(stmt.getName(), typeName)
        this.body.write(stmt.getComposite().getName())
        switch (stmt.elementIndex) {
            case 0: {
                this.body.write(".x")
                break;
            }
            case 1: {
                this.body.write(".y")
                break;
            }
            case 2: {
                this.body.write(".z")
                break;
            }
            case 3: {
                this.body.write(".w")
                break;
            }
            default: {
                error("unsupported composite extract index: ", stmt.elementIndex);
            }
        }
        this.body.write(";\n");
    }

    override visitArgLoadStmt(stmt: ArgLoadStmt): void {
        let argId = stmt.argId
        let dt = stmt.getReturnType()
        let dtName = this.getPrimitiveTypeName(dt)
        let bufferName = this.getBufferMemberName(new ResourceInfo(ResourceType.Args))
        if (!this.enforce16BytesAlignment) {
            this.emitLet(stmt.getName(), dtName)
            this.body.write(`bitcast<${dtName}>(${bufferName}[${argId}]);\n`)
        }
        else {
            let temp = this.getTemp()
            this.emitLet(temp, "i32")
            this.body.write(`find_vec4_component(${bufferName}[${argId}${this.getRawDataTypeIndexShift()}], ${argId});\n`)
            this.emitLet(stmt.getName(), dtName)
            this.body.write(`bitcast<${dtName}>(${temp});\n`)
        }
    }

    override visitReturnStmt(stmt: ReturnStmt): void {
        if (this.enforce16BytesAlignment()) {
            error("Ret cannot be used while enforcing 16 bytes alignment")
        }
        let values = stmt.getValues()
        for (let i = 0; i < values.length; ++i) {
            this.body.write(this.getIndentation(), `${this.getBufferMemberName(new ResourceInfo(ResourceType.Rets))}[${i}] = `)
            let dt = values[i].getReturnType()
            switch (dt) {
                case PrimitiveType.f32: {
                    this.body.write(`bitcast<i32>(${values[i].getName()});\n`)
                    break;
                }
                case PrimitiveType.i32: {
                    this.body.write(`${values[i].getName()};\n`)
                    break;
                }
                default: {
                    error("unrecognized prim type")
                }
            }
        }
    }

    override visitAllocaStmt(stmt: AllocaStmt): void {
        let dt = stmt.allocatedType
        // not using emit_var() because it emits an extra equals token..
        this.body.write(this.getIndentation(), `var ${stmt.getName()} : ${this.getPrimitiveTypeName(dt)};\n`)
    }

    override visitLocalLoadStmt(stmt: LocalLoadStmt): void {
        let dt = stmt.getReturnType()
        this.emitLet(stmt.getName(),dt)
        this.body.write(stmt.getPointer().getName())
    }

    override visitLocalStoreStmt(stmt: LocalStoreStmt): void {
        this.body.write(this.getIndentation(),`${stmt.getPointer().getName()} = ${stmt.getValue().getName()};\n`)
    }

    emitLet(name: string, type: string) {
        this.body.write(this.getIndentation(), `let ${name} : ${type} = `)
    }

    emitVar(name: string, type: string) {
        this.body.write(this.getIndentation(), `var ${name} : ${type} = `)
    }

    getPointerIntTypeName() {
        return "i32"
    }

    getPrimitiveTypeName(dt: PrimitiveType) {
        switch (dt) {
            case PrimitiveType.f32:
                return "f32"
            case PrimitiveType.i32:
                return "i32"
            default:
                error(`unsupported primitive type `, dt)
                return "error"
        }
    }

    getScalarOrVectorTypeName(dt: PrimitiveType, numComponents: number) {
        let primName = this.getPrimitiveTypeName(dt)
        let typeName = primName
        if (numComponents > 1) {
            typeName = `vec${numComponents}<${primName}>`
        }
        return typeName
    }

    getScalarOrVectorExpr(values: Stmt[], typeName: string) {
        let outputExpr = values[0].getName()
        if (values.length > 1) {
            outputExpr = `${typeName}(${values[0].getName()}`
            for (let i = 1; i < values.length; ++i) {
                outputExpr += `, ${values[i].getName()}`
            }
            outputExpr += ")"
        }
        return outputExpr
    }


    globalDecls = new StringBuilder

    stageInStructBegin = new StringBuilder
    stageInStructBody = new StringBuilder
    stageInStructEnd = new StringBuilder

    stageOutStructBegin = new StringBuilder
    stageOutStructBody = new StringBuilder
    stageOutStructEnd = new StringBuilder

    funtionSignature = new StringBuilder
    functionBodyPrologue = new StringBuilder
    body = new StringBuilder
    functionBodyEpilogue = new StringBuilder
    functionEnd = new StringBuilder

    assembleShader() {
        return (
            this.globalDecls.getString() +
            this.stageInStructBegin.getString() +
            this.stageInStructBody.getString() +
            this.stageInStructEnd.getString() +

            this.stageOutStructBegin.getString() +
            this.stageOutStructBody.getString() +
            this.stageOutStructEnd.getString() +

            this.funtionSignature.getString() +
            this.functionBodyPrologue.getString() +
            this.body.getString() +
            this.functionBodyEpilogue.getString() +
            this.functionEnd.getString()
        )
    }


    startComputeFunction(blockSizeX: number) {
        assert(this.funtionSignature.empty(), "already has a signature")
        let signature = `
@stage(compute) @workgroup_size(${blockSizeX}, 1, 1)
fn main(
    @builtin(global_invocation_id) gid3 : vec3<u32>, 
    @builtin(num_workgroups) n_workgroups : vec3<u32>) 
{        
`
        this.funtionSignature.write(signature)
        this.functionEnd.write("}\n")
    }

    emitGraphicsFunction() {
        assert(this.funtionSignature.empty(), "already has a signature")
        let stageName = ""
        let builtInInput = ""
        let stageInput = ""
        let maybeOutput = ""
        if (this.isVertexFor()) {
            stageName = "vertex"
            builtInInput = `@builtin(vertex_index) vertex_index : u32,  @builtin(instance_index) instance_index : u32`
            if (!this.stageInStructBegin.empty()) {
                builtInInput += ", "
            }
        }
        else if (this.isFragmentFor()) {
            stageName = "fragment"
            builtInInput = ""
        }
        else {
            error("emit_graphics_function called, but we're not in vert/frag for")
        }
        if (!this.stageInStructBegin.empty()) {
            stageInput = "stage_input: StageInput"
        }
        if (!this.stageOutStructBegin.empty()) {
            maybeOutput = "-> StageOutput"
        }
        let signature = `
@stage(${stageName})
fn main(${builtInInput} ${stageInput}) ${maybeOutput}
{

)
`
        this.funtionSignature.write(signature)
        this.functionEnd.write("\n}\n")

        if (this.enforce16BytesAlignment()) {
            let helper = `
fn find_vec4_component(v: vec4<i32>, index: i32) -> i32 
{
    if((index & 3) == 0){
        return v.x;
    }
    if((index & 3) == 1){
        return v.y;
    }
    if((index & 3) == 2){
        return v.z;
    }
    return v.w;
}            
`
            this.globalDecls.write(helper)
        }
    }


    ensureStageInStruct() {
        if (this.stageInStructBegin.parts.length > 0) {
            return
        }
        this.stageInStructBegin.write("struct StageInput {\n")
        this.stageInStructEnd.write("};\n")

    }
    ensureStageOutStruct() {
        if (this.stageOutStructBegin.parts.length > 0) {
            return
        }
        this.stageOutStructBegin.write("struct StageOutput {\n")
        this.stageOutStructEnd.write("};\n")

        this.functionBodyPrologue.write("  var stage_output: StageOutput;\n")
        this.functionBodyEpilogue.write("  return stage_output;\n")
    }

    stageInMembers: Set<string> = new Set<string>()
    addStageInMember(name: string, dt: string, loc: number, flat: boolean) {
        if (!this.stageInMembers.has(name)) {
            this.stageInStructBody.write(`  @location(${loc}) `)
            if (flat) {
                this.stageInStructBody.write(`@interpolate(flat) `)
            }
            this.stageInStructBody.write(`${name} : ${dt},\n`);
            this.stageInMembers.add(name)
        }
    }

    stageOutMembers: Set<string> = new Set<string>()
    addStageOutMember(name: string, dt: string, loc: number, flat: boolean) {
        if (!this.stageOutMembers.has(name)) {
            this.stageOutStructBody.write(`  @location(${loc}) `)
            if (flat) {
                this.stageOutStructBody.write(`@interpolate(flat) `)
            }
            this.stageOutStructBody.write(`${name} : ${dt},\n`);
            this.stageOutMembers.add(name)
        }
    }

    stageOutBuiltinMembers: Set<string> = new Set<string>()
    addStageOutBuiltinMember(name: string, dt: string, builtin: string) {
        if (!this.stageOutBuiltinMembers.has(name)) {
            this.stageOutStructBody.write(`  @builtin(${builtin}) ${name} : ${dt},\n`)
            this.stageOutMembers.add(name)
        }
    }

    bodyIndentCount = 1;
    indent() {
        this.bodyIndentCount++;
    }
    dedent() {
        this.bodyIndentCount--;
    }
    getIndentation() {
        return "  ".repeat(this.bodyIndentCount)
    }

    nextInternalTemp = 0
    getTemp(hint: string = "") {
        return `_internal_temp_${this.nextInternalTemp++}_${hint}`
    }

    isVertexFor() {
        return this.offload.type === OffloadType.Vertex
    }

    isFragmentFor() {
        return this.offload.type === OffloadType.Fragment
    }

    enforce16BytesAlignment() {
        return this.isVertexFor() || this.isFragmentFor()
    }

    getRawDataTypeName() {
        if (!this.enforce16BytesAlignment()) {
            return "i32"
        }
        else {
            return "vec4<i32>"
        }
    }

    getRawDataTypeSize() {
        if (!this.enforce16BytesAlignment()) {
            return 4
        }
        else {
            return 16
        }
    }

    getRawDataTypeIndexShift() {
        if (!this.enforce16BytesAlignment()) {
            return ""
        }
        else {
            return " >> 2u";
        }
    }

    getElementCount(buffer: ResourceInfo) {
        switch (buffer.resourceType) {
            case ResourceType.Root: {
                let treeSize = this.runtime.materializedTrees[buffer.resourceID!].size
                return divUp(treeSize, this.getRawDataTypeSize())
            }
            case ResourceType.RootAtomic: {
                let treeSize = this.runtime.materializedTrees[buffer.resourceID!].size
                return divUp(treeSize, 4)
                // WGSL doesn't allow atomic<vec4<i32>>, so the type size is always 4
            }
            case ResourceType.GlobalTmps: {
                return divUp(65536, this.getRawDataTypeSize());
                // maximum size (ubo) allowed by WebGPU Chrome DX backend. matches Runtime.ts
            }
            case ResourceType.RandStates: {
                return 65536;
                // matches Runtime.ts // note that we have up to 65536 shader invocations
            }
            case ResourceType.Args: {
                return divUp(this.argBytes, this.getRawDataTypeSize());
            }
            case ResourceType.Rets: {
                return divUp(this.retBytes, this.getRawDataTypeSize());
            }
            default: {
                error("not a buffer")
                return -1
            }
        }
    }

    resourceBindings: ResourceBindingMap = new ResourceBindingMap

    getBufferName(buffer: ResourceInfo) {
        let name = ""
        let elementType = this.getRawDataTypeName()
        switch (buffer.resourceType) {
            case ResourceType.Root: {
                name = "root_buffer_" + buffer.resourceID!.toString() + "_";
                break;
            }
            case ResourceType.RootAtomic: {
                name = "root_buffer_" + buffer.resourceID!.toString() + "_atomic_";
                elementType = "atomic<i32>";
                break;
            }
            case ResourceType.GlobalTmps: {
                name = "global_tmps_";
                break;
            }
            case ResourceType.RandStates: {
                name = "rand_states_";
                elementType = "RandState";
                break;
            }
            case ResourceType.Args: {
                name = "args_";
                break;
            }
            case ResourceType.Rets: {
                name = "rets_";
                break;
            }
            default: {
                error("not a buffer")
            }
        }
        if (!this.resourceBindings.has(buffer)) {
            let binding = this.bindingPointBegin + this.resourceBindings.size()
            this.resourceBindings.add(buffer, binding)
            let elementCount = this.getElementCount(buffer)
            this.declareNewBuffer(buffer, name, binding, elementType, elementCount)
        }
        return name
    }

    declareNewBuffer(buffer: ResourceInfo, name: string, binding: number, elementType: string, elementCount: number) {
        let storageAndAcess = "storage, read_write"
        if (this.enforce16BytesAlignment()) {
            storageAndAcess = "uniform";
        }
        let code = `
struct ${name}_type {
    member: array<${elementType}, ${elementCount}>,
};
@group(0) @binding(${binding})
var<${storageAndAcess}> ${name}: ${name}_type;        
`
        this.globalDecls.write(code)
    }

    getBufferMemberName(buffer: ResourceInfo) {
        return this.getBufferName(buffer) + ".name"
    }

    getTextureName(textureInfo: ResourceInfo) {
        if (textureInfo.resourceType !== ResourceType.Texture && textureInfo.resourceType !== ResourceType.StorageTexture) {
            error("not a texture")
        }
        let isStorageTexture = (textureInfo.resourceType === ResourceType.StorageTexture)
        let texture = this.runtime.textures[textureInfo.resourceID!]
        let name = `texture_${textureInfo.resourceID!}_`
        if (isStorageTexture) {
            name += "storage_";
        }
        let elementType = this.getPrimitiveTypeName(PrimitiveType.f32)
        let typeName = ""
        let isDepth = texture instanceof DepthTexture
        switch (texture.getTextureDimensionality()) {
            case TextureDimensionality.Dim2d: {
                if (!isDepth) {
                    if (isStorageTexture) {
                        typeName = "texture_storage_2d"
                    }
                    else {
                        typeName = "texture_2d"
                    }
                }
                else {
                    error("depth 2d texture not supported")
                }
                break;
            }
            case TextureDimensionality.Dim3d: {
                if (!isDepth) {
                    if (isStorageTexture) {
                        typeName = "texture_storage_3d"
                    }
                    else {
                        typeName = "texture_3d"
                    }
                }
                else {
                    error("depth 3d texture not supported")
                }
                break;
            }
            case TextureDimensionality.DimCube: {
                if (!isDepth) {
                    if (isStorageTexture) {
                        error("storage cube texture not supported")
                    }
                    else {
                        typeName = "texture_3d"
                    }
                }
                else {
                    error("depth cube texture not supported")
                }
                break;
            }
            default: {
                error("unrecognized dimensionality")
            }
        }
        if (!this.resourceBindings.has(textureInfo)) {
            let binding = this.bindingPointBegin + this.resourceBindings.size()
            this.resourceBindings.add(textureInfo, binding)
            let templateArgs = ""
            if (isStorageTexture) {
                templateArgs = `<${texture.getGPUTextureFormat() as string}, write>`
            }
            else {
                templateArgs = `<${elementType}>`
            }
            this.declareNewTexture(textureInfo, name, typeName, templateArgs, binding)
        }
        return name
    }

    declareNewTexture(texture: ResourceInfo, name: string, typeName: string, templateArgs: string, binding: number) {
        let decl = `
@group(0) @binding(${binding})
var ${name}: ${typeName}${templateArgs};
        `
    }

    getSamplerName(samplerInfo: ResourceInfo) {
        if (samplerInfo.resourceType !== ResourceType.Sampler) {
            error("not a sampler")
        }
        let texture = this.runtime.textures[samplerInfo.resourceID!]
        let name = `sampler_${samplerInfo.resourceID!}_`
        let typeName = "sampler"
        let isDepth = texture instanceof DepthTexture
        if (isDepth) {
            error("depth texture not supported")
        }
        if (!this.resourceBindings.has(samplerInfo)) {
            let binding = this.bindingPointBegin + this.resourceBindings.size()
            this.resourceBindings.add(samplerInfo, binding)
            this.declareNewSampler(samplerInfo, name, typeName, binding)
        }
        return name
    }

    declareNewSampler(sampler: ResourceInfo, name: string, typeName: string, binding: number) {
        let decl = `
@group(0) @binding(${binding})
var ${name}: ${typeName};
        `
    }

    randInitiated = false
    initRand() {
        if (this.randInitiated) {
            return
        }
        let structDecl = `
struct RandState{
    x: u32,
    y: u32,
    z: u32,
    w: u32,
};
`
        this.globalDecls.write(structDecl)
        let randStatesMemberName = this.getBufferMemberName(new ResourceInfo(ResourceType.RandStates))
        let randFuncs = `
fn rand_u32(id: u32) -> u32 {
    var state : RandState = STATES[id];
    if(state.x == 0u && state.y == 0u && state.z == 0u && state.w == 0u){
        state.x = 123456789u * id * 1000000007u;
        state.y = 362436069u;
        state.z = 521288629u;
        state.w = 88675123u;
    }
    let t : u32 = state.x ^ (state.x << 11u);
    state.x = state.y;
    state.y = state.z;
    state.z = state.w;
    state.w = (state.w ^ (state.w >> 19u)) ^ (t ^ (t >> 8u)); 
    let result : u32 = state.w * 1000000007u;
    ${randStatesMemberName}[id] = state;
    return result;
}

fn rand_f32(id:u32) -> f32 {
    let u32_res : u32 = rand_u32(id);
    return f32(u32_res) * (1.0f / 4294967296.0f);
}

fn rand_i32(id:u32) -> i32 {
    let u32_res : u32 = rand_u32(id);
    return i32(u32_res);
}
`
        this.globalDecls.write(randFuncs)
        this.randInitiated = true
    }




}

