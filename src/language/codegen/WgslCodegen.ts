import { DepthTexture, getTextureCoordsNumComponents, TextureDimensionality } from "../../data/Texture";
import { Program } from "../../program/Program";
import { FragmentShaderParams, ResourceBinding, ResourceInfo, ResourceType, TaskParams, VertexShaderParams } from "../../runtime/Kernel";
import { Runtime } from "../../runtime/Runtime";
import { assert, error } from "../../utils/Logging";
import { StringBuilder } from "../../utils/StringBuilder";
import { divUp } from "../../utils/Utils";
import { PrimitiveType } from "../frontend/Type";
import { AllocaStmt, ArgLoadStmt, AtomicLoadStmt, AtomicOpStmt, AtomicOpType, AtomicStoreStmt, BinaryOpStmt, BinaryOpType, BuiltInInputKind, BuiltInInputStmt, BuiltInOutputKind, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, DiscardStmt, FragmentDerivativeDirection, FragmentDerivativeStmt, FragmentForStmt, FragmentInputStmt, getBuiltinInputComponentCount, getBuiltinInputPrimitiveType, getPointedType, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, GlobalTemporaryStoreStmt, IfStmt, LocalLoadStmt, LocalStoreStmt, LoopIndexStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, StmtKind, TextureFunctionKind, TextureFunctionStmt, UnaryOpStmt, UnaryOpType, VertexForStmt, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "../ir/Stmt";
import { IRVisitor } from "../ir/Visitor";
import { ComputeModule, OffloadedModule, OffloadType } from "./Offload";

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

export class CodegenVisitor extends IRVisitor {
    constructor(
        public runtime: Runtime,
        public offload: OffloadedModule,
        public argBytes: number,
        public retBytes: number,
        // when generating code for fragment shader, need to take into count the bindings used by the vertex shader, because they are in the same synchronization scope
        public previousStageBindings: ResourceBinding[]
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
                case UnaryOpType.bit_not: {
                    return `(~(${operand}))`
                }
                default: {
                    error("unhandled unary op ", op)
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
        let dt = stmt.getReturnType()

        let getValue = () => {
            switch (op) {
                case BinaryOpType.mul: return `(${lhs} * ${rhs})`
                case BinaryOpType.add: return `(${lhs} + ${rhs})`
                case BinaryOpType.sub: return `(${lhs} - ${rhs})`
                case BinaryOpType.truediv: return `(f32(${lhs}) / f32(${rhs}))`
                case BinaryOpType.floordiv: return `i32(${lhs} / ${rhs})`
                case BinaryOpType.mod: return `(${lhs} % ${rhs})`
                case BinaryOpType.max: return `max(${lhs}, ${rhs})`
                case BinaryOpType.min: return `min(${lhs}, ${rhs})`
                case BinaryOpType.bit_and: return `(${lhs} & ${rhs})`
                case BinaryOpType.bit_or: return `(${lhs} | ${rhs})`
                case BinaryOpType.bit_xor: return `(${lhs} ^ ${rhs})`
                case BinaryOpType.bit_shl: return `(${lhs} << u32(${rhs}))`
                case BinaryOpType.bit_shr: return `(u32(${lhs}) >> u32(${rhs}))`
                case BinaryOpType.bit_sar: return `(${lhs} >> u32(${rhs}))`
                case BinaryOpType.cmp_lt: return `(${lhs} < ${rhs})`
                case BinaryOpType.cmp_le: return `(${lhs} <= ${rhs})`
                case BinaryOpType.cmp_gt: return `(${lhs} > ${rhs})`
                case BinaryOpType.cmp_ge: return `(${lhs} >= ${rhs})`
                case BinaryOpType.cmp_eq: return `(${lhs} == ${rhs})`
                case BinaryOpType.cmp_ne: return `(${lhs} != ${rhs})`
                case BinaryOpType.atan2: return `atan2(f32(${lhs}), f32(${rhs}))`
                case BinaryOpType.logical_or: return `(${lhs} | ${rhs})`
                case BinaryOpType.logical_and: return `(${lhs} & ${rhs})`
                case BinaryOpType.pow: {
                    // pow is special because
                    // 1. for integer LHS and RHS, result is integer
                    // 2. WGSL only has float version
                    // so we round the result if the inputs are ints
                    switch (dt) {
                        case PrimitiveType.i32: {
                            return `round(pow(f32(${lhs}), f32(${rhs})))`
                        }
                        case PrimitiveType.f32: {
                            return `pow(f32(${lhs}), f32(${rhs}))`
                        }
                        default: {
                            error("unrecgnized prim type")
                            return "error"
                        }
                    }
                }
            }
        }
        let value = getValue()
        let dtName = this.getPrimitiveTypeName(dt)
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`${dtName}(${value});\n`)
    }

    override visitRangeForStmt(stmt: RangeForStmt): void {
        this.emitVar(stmt.getName(), "i32")
        this.body.write("0;\n");
        this.body.write(this.getIndentation(), "loop {\n")
        this.indent()
        this.body.write(this.getIndentation(), `if (${stmt.getName()} >= ${stmt.getRange().getName()}) { break; }\n`)

        this.visitBlock(stmt.body)

        this.body.write(this.getIndentation(), `${stmt.getName()} = ${stmt.getName()} + 1;\n`);
        this.dedent()
        this.body.write(this.getIndentation(), "}\n")
    }

    override visitIfStmt(stmt: IfStmt): void {
        this.body.write(this.getIndentation(), `if (bool(${stmt.getCondition().getName()})) {\n`)
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
        // the `continuing` block means that this will work for both normal loops and grid-strided loops
        this.body.write(this.getIndentation(), "continue;\n");
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
        let flat = stmt.getValue().getReturnType() == PrimitiveType.i32
        this.addStageOutMember(outputName, dtName, loc, flat)
        this.body.write(this.getIndentation(), `stage_output.${outputName} = ${stmt.getValue().getName()};\n`);
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
                this.addStageOutMember(outputName, typeName, loc, false)
                break;
            }
            case BuiltInOutputKind.Position: {
                outputName = `position`
                this.addStageOutBuiltinMember(outputName, typeName, "position")
                break;
            }
            case BuiltInOutputKind.FragDepth: {
                outputName = `frag_depth`
                this.addStageOutBuiltinMember(outputName, typeName, "frag_depth")
                break;
            }
            default:
                error("unrecognized builtin kind")
        }
        this.body.write(this.getIndentation(), `stage_output.${outputName} = ${outputExpr};\n`);
    }

    override visitBuiltInInputStmt(stmt: BuiltInInputStmt): void {
        let primType = getBuiltinInputPrimitiveType(stmt.builtinKind)
        let componentCount = getBuiltinInputComponentCount(stmt.builtinKind)
        let dtName = this.getScalarOrVectorTypeName(primType, componentCount)
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
            case BuiltInInputKind.FragCoord: {
                this.body.write("frag_coord");
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
                this.body.write("dpdyFine")
                break;
            }
            default:
                error("unrecognized direction")
        }
        this.body.write(`(${stmt.getValue().getName()});\n`)
    }

    override visitDiscardStmt(stmt: DiscardStmt): void {
        this.body.write(this.getIndentation(), "discard;\n")
    }

    override visitTextureFunctionStmt(stmt: TextureFunctionStmt): void {
        let texture = stmt.texture
        let isDepth = texture instanceof DepthTexture
        let textureResource = new ResourceInfo(ResourceType.Texture, texture.textureId)
        let requiresSampler = false
        let resultNumComponents = isDepth ? 1 : 4;

        switch (stmt.func) {
            case TextureFunctionKind.Sample: {
                requiresSampler = true
                break;
            }
            case TextureFunctionKind.SampleLod: {
                requiresSampler = true
                break;
            }
            case TextureFunctionKind.SampleCompare: {
                requiresSampler = true
                resultNumComponents = 1
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

        let texelTypeName = this.getScalarOrVectorTypeName(PrimitiveType.f32, resultNumComponents)

        let samplerName = ""
        if (requiresSampler) {
            let samplerResource = new ResourceInfo(ResourceType.Sampler, texture.textureId)
            samplerName = this.getSamplerName(samplerResource)
        }
        let coordsComponentCount = getTextureCoordsNumComponents(texture.getTextureDimensionality())
        assert(coordsComponentCount === stmt.getCoordinates().length, "component count mismatch", stmt)

        let coordsPrimType = stmt.getCoordinates()[0].getReturnType()
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
            case TextureFunctionKind.SampleCompare: {
                assert(stmt.getAdditionalOperands().length === 1, "expecting 1 depth ref value")
                this.emitLet(stmt.getName(), texelTypeName)
                this.body.write(`textureSampleCompare(${textureName}, ${samplerName}, ${coordsExpr}, ${stmt.getAdditionalOperands()[0].getName()});\n`)
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
                this.body.write(this.getIndentation(), `textureStore(${textureName}, ${coordsExpr}, ${valueExpr});\n`)
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
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`bitcast<${dtName}>(${bufferName}[${argId}]);\n`)
    }

    override visitReturnStmt(stmt: ReturnStmt): void {
        if (this.isVertexFor() || this.isFragmentFor()) {
            error("Return cannot be used in a vertex-for or a fragment-for")
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
        this.emitLet(stmt.getName(), dt)
        this.body.write(stmt.getPointer().getName(), ";\n")
    }

    override visitLocalStoreStmt(stmt: LocalStoreStmt): void {
        this.body.write(this.getIndentation(), `${stmt.getPointer().getName()} = ${stmt.getValue().getName()};\n`)
    }

    override visitGlobalPtrStmt(stmt: GlobalPtrStmt): void {
        let field = stmt.field
        let indices = stmt.getIndices()
        assert(indices.length === field.dimensions.length, "global ptr dimension mismatch")
        let elementIndex = ""
        let currStride = 1
        for (let i = field.dimensions.length - 1; i >= 0; --i) {
            elementIndex += `${currStride} * ${indices[i].getName()}`
            if (i > 0) {
                elementIndex += " + "
            }
            currStride *= field.dimensions[i]
        }
        let index = `${field.offsetBytes / 4} + ${field.elementType.getPrimitivesList().length} * (${elementIndex}) + ${stmt.offsetInElement}`
        this.emitLet(stmt.getName(), this.getPointerIntTypeName())
        this.body.write(index, ";\n");
    }

    override visitGlobalTemporaryStmt(stmt: GlobalTemporaryStmt): void {
        this.emitLet(stmt.getName(), this.getPointerIntTypeName())
        this.body.write(stmt.offset, ";\n");
    }

    emitGlobalLoadExpr(stmt: GlobalLoadStmt | GlobalTemporaryLoadStmt | AtomicLoadStmt, atomic:boolean = false) {
        let resourceInfo: ResourceInfo
        let ptr = stmt.getPointer()
        if (ptr.getKind() === StmtKind.GlobalPtrStmt) {
            ptr = ptr as GlobalPtrStmt
            let resourceType = atomic?ResourceType.RootAtomic : ResourceType.Root
            resourceInfo = new ResourceInfo(resourceType, ptr.field.snodeTree.treeId)
            let tree = this.runtime.materializedTrees[ptr.field.snodeTree.treeId]
            if (tree.fragmentShaderWritable) {
                error("A vertex shader cannot read from a field marked as `fragmentShaderWritable`")
            }
        }
        else {
            let resourceType = atomic?ResourceType.GlobalTmpsAtomic : ResourceType.GlobalTmps
            resourceInfo = new ResourceInfo(resourceType)
        }
        let bufferName = this.getBufferMemberName(resourceInfo)
        let dt = stmt.getReturnType()
        let dtName = this.getPrimitiveTypeName(dt)
        this.emitLet(stmt.getName(), dt)
        if (atomic){
            this.body.write(`bitcast<${dtName}>(atomicLoad(&(${bufferName}[${ptr.getName()}])));\n`)
        }
        else{
            this.body.write(`bitcast<${dtName}>(${bufferName}[${ptr.getName()}]);\n`)
        }
    }

    emitGlobalStore(stmt: GlobalStoreStmt | GlobalTemporaryStoreStmt| AtomicStoreStmt, atomic:boolean = false) {
        let resourceInfo: ResourceInfo
        let ptr = stmt.getPointer()
        if (ptr.getKind() === StmtKind.GlobalPtrStmt) {
            ptr = ptr as GlobalPtrStmt
            let resourceType = atomic?ResourceType.RootAtomic : ResourceType.Root
            resourceInfo = new ResourceInfo(resourceType, ptr.field.snodeTree.treeId)
        }
        else {
            let resourceType = atomic?ResourceType.GlobalTmpsAtomic : ResourceType.GlobalTmps
            resourceInfo = new ResourceInfo(resourceType)
        }
        let bufferName = this.getBufferMemberName(resourceInfo)
        this.assertBufferWritable(resourceInfo)
        let value = `bitcast<${this.getRawDataTypeName()}>(${stmt.getValue().getName()})`
        if (atomic){
            this.body.write(this.getIndentation(),`atomicStore(&(${bufferName}[${ptr.getName()}]), ${value});\n`)
        }
        else{
            this.body.write(this.getIndentation(), `${bufferName}[${ptr.getName()}] = ${value};\n`)
        }
    }

    override visitGlobalLoadStmt(stmt: GlobalLoadStmt): void {
        this.emitGlobalLoadExpr(stmt, /*atomic=*/ false)
    }

    override visitGlobalStoreStmt(stmt: GlobalStoreStmt): void {
        this.emitGlobalStore(stmt,/*atomic=*/ false)
    }

    override visitGlobalTemporaryLoadStmt(stmt: GlobalTemporaryLoadStmt): void {
        this.emitGlobalLoadExpr(stmt,/*atomic=*/ false)
    }

    override visitGlobalTemporaryStoreStmt(stmt: GlobalTemporaryStoreStmt): void {
        this.emitGlobalStore(stmt,/*atomic=*/ false)
    }

    override visitAtomicOpStmt(stmt: AtomicOpStmt): void {
        let dt = getPointedType(stmt.getDestination())
        let dtName = this.getPrimitiveTypeName(dt)
        let resourceInfo: ResourceInfo
        let dest = stmt.getDestination()
        if (dest.getKind() === StmtKind.GlobalPtrStmt) {
            dest = dest as GlobalPtrStmt
            resourceInfo = new ResourceInfo(ResourceType.RootAtomic, (dest as GlobalPtrStmt).field.snodeTree.treeId)
        }
        else {
            resourceInfo = new ResourceInfo(ResourceType.GlobalTmpsAtomic)
        }
        this.assertBufferWritable(resourceInfo)
        let bufferName = this.getBufferMemberName(resourceInfo)


        let result = this.getTemp("atomic_op_result");
        this.body.write(this.getIndentation(), `var ${result} : ${dtName};\n`)
        let ptr = `&(${bufferName}[${stmt.getDestination().getName()}])`
        switch (dt) {
            case PrimitiveType.i32: {
                let atomicFuncName = ""
                switch (stmt.op) {
                    case AtomicOpType.add: {
                        atomicFuncName = "atomicAdd";
                        break;
                    }
                    case AtomicOpType.sub: {
                        atomicFuncName = "atomicSub";
                        break;
                    }
                    case AtomicOpType.max: {
                        atomicFuncName = "atomicMax";
                        break;
                    }
                    case AtomicOpType.min: {
                        atomicFuncName = "atomicMin";
                        break;
                    }
                    case AtomicOpType.bit_and: {
                        atomicFuncName = "atomicAnd";
                        break;
                    }
                    case AtomicOpType.bit_or: {
                        atomicFuncName = "atomicOr";
                        break;
                    }
                    case AtomicOpType.bit_xor: {
                        atomicFuncName = "atomicXor";
                        break;
                    }
                    default: {
                        error("atomic op not supported")
                    }
                }
                this.body.write(`${result} = ${atomicFuncName}(${ptr}, ${stmt.getOperand().getName()});\n`)
                break;
            }
            case PrimitiveType.f32: {
                /*
                fn atomicAddFloat(dest: ptr<storage, atomic<i32>, read_write>, v: f32) -> f32 {
                    loop {
                        let old_val : f32 = bitcast<f32>(atomicLoad(dest));
                        let new_val : f32 = old_val + v;
                        if(atomicCompareExchangeWeak(dest, bitcast<i32>(old_val),bitcast<i32>(new_val)).y != 0){ 
                            return old_val;
                        }
                    }
                }
                */

                // WGSL doesn't allow declaring a function whose argument is a pointer to
                // SSBO... so we inline it

                this.body.write(this.getIndentation(), "loop { \n");
                this.indent()

                let oldVal = this.getTemp("old_val");
                this.emitLet(oldVal, "f32")
                this.body.write(`bitcast<f32>(atomicLoad(${ptr}));\n`)

                let newValExpr = ""
                switch (stmt.op) {
                    case AtomicOpType.add: {
                        newValExpr = `${oldVal} + ${stmt.getOperand().getName()}`;
                        break;
                    }
                    case AtomicOpType.sub: {
                        newValExpr = `${oldVal} - ${stmt.getOperand().getName()}`;
                        break;
                    }
                    case AtomicOpType.max: {
                        newValExpr = `max(${oldVal}, ${stmt.getOperand().getName()})`;
                        break;
                    }
                    case AtomicOpType.min: {
                        newValExpr = `min(${oldVal}, ${stmt.getOperand().getName()})`;
                        break;
                    }
                    default: {
                        error("atomic op not supported for f32")
                    }
                }

                let newVal = this.getTemp("new_val");
                this.emitLet(newVal, "f32")
                this.body.write(`${newValExpr};\n`)

                this.body.write(this.getIndentation(), `if(atomicCompareExchangeWeak(${ptr}, bitcast<i32>(${oldVal}), bitcast<i32>(${newVal})).exchanged){\n`)
                this.indent()
                this.body.write(this.getIndentation(), `${result} = ${oldVal};\n`)
                this.body.write(this.getIndentation(), `break;\n`)
                this.dedent()
                this.body.write(this.getIndentation(), "}\n")
                this.dedent()
                this.body.write(this.getIndentation(), "}\n")
                break;
            }
            default: {
                error("unrecognized prim type")
            }
        }
        this.emitLet(stmt.getName(), dtName)
        this.body.write(`${result};\n`)
    }

    override visitAtomicLoadStmt(stmt: AtomicLoadStmt): void {
        this.emitGlobalLoadExpr(stmt,/*atomic=*/ true)
    }

    override visitAtomicStoreStmt(stmt: AtomicStoreStmt): void {
        this.emitGlobalStore(stmt,/*atomic=*/ true)
    }

    override visitLoopIndexStmt(stmt: LoopIndexStmt): void {
        let loop = stmt.getLoop() as RangeForStmt
        if (loop.isParallelFor) {
            this.emitLet(stmt.getName(), "i32")
            this.body.write("ii;\n")
        }
        else {
            this.emitLet(stmt.getName(), "i32")
            this.body.write(`${stmt.getLoop().getName()};\n`)
        }
    }

    override visitFragmentForStmt(stmt: FragmentForStmt): void {
        error("FragmentForStmt should have been offloaded")
    }

    override visitVertexForStmt(stmt: VertexForStmt): void {
        error("VertexForStmt should have been offloaded")
    }

    generateSerialKernel(): TaskParams {
        this.startComputeFunction(1)
        this.visitBlock(this.offload.block)
        return new TaskParams(this.assembleShader(), 1, 1, this.resourceBindings.bindings)
    }

    generateRangeForKernel() {
        let blockSize = 128
        let numWorkgroups = 512

        let offload = this.offload as ComputeModule
        let endExpr = ""
        if (offload.hasConstRange) {
            endExpr = `${offload.rangeArg}`
            numWorkgroups = divUp(offload.rangeArg, blockSize)
        }
        else {
            let resource = new ResourceInfo(ResourceType.GlobalTmps)
            let buffer = this.getBufferMemberName(resource)
            endExpr = `${buffer}[${offload.rangeArg}]`
        }

        this.startComputeFunction(blockSize)

        let end = this.getTemp("end")
        this.emitLet(end, "i32")
        this.body.write(`${endExpr};\n`)

        let totalInvocs = this.getTemp("total_invocs")
        this.emitLet(totalInvocs, "i32");
        this.body.write(`${blockSize} * i32(n_workgroups.x);\n`)

        this.emitVar("ii", "i32")
        this.body.write("i32(gid3.x);\n")

        this.body.write(this.getIndentation(), "loop {\n")
        this.indent()

        this.body.write(this.getIndentation(), `if(ii >= ${end}) { break; }\n`)
        this.visitBlock(this.offload.block)
        this.body.write(this.getIndentation(), `continuing { ii = ii + ${totalInvocs}; }\n`)

        this.dedent()
        this.body.write(this.getIndentation(), "}\n")
        return new TaskParams(this.assembleShader(), blockSize, numWorkgroups, this.resourceBindings.bindings)
    }

    generateVertexForKernel() {
        this.visitBlock(this.offload.block)
        this.startGraphicsFunction()
        return new VertexShaderParams(this.assembleShader(), this.resourceBindings.bindings)
    }

    generateFragmentForKernel() {
        this.visitBlock(this.offload.block)
        this.startGraphicsFunction()
        return new FragmentShaderParams(this.assembleShader(), this.resourceBindings.bindings)
    }

    generate() {
        switch (this.offload.type) {
            case OffloadType.Serial: {
                return this.generateSerialKernel()
            }
            case OffloadType.Compute: {
                return this.generateRangeForKernel()
            }
            case OffloadType.Vertex: {
                return this.generateVertexForKernel()
            }
            case OffloadType.Fragment: {
                return this.generateFragmentForKernel()
            }
        }
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
@compute @workgroup_size(${blockSizeX}, 1, 1)
fn main(
    @builtin(global_invocation_id) gid3 : vec3<u32>, 
    @builtin(num_workgroups) n_workgroups : vec3<u32>) 
{        
`
        this.funtionSignature.write(signature)
        this.functionEnd.write("}\n")
    }

    startGraphicsFunction() {
        assert(this.funtionSignature.empty(), "already has a signature")
        let stageName = ""
        let builtInInput = ""
        let stageInput = ""
        let maybeOutput = ""
        if (this.isVertexFor()) {
            stageName = "vertex"
            builtInInput = `@builtin(vertex_index) vertex_index : u32,  @builtin(instance_index) instance_index : u32`
        }
        else if (this.isFragmentFor()) {
            stageName = "fragment"
            builtInInput = "@builtin(position) frag_coord : vec4<f32>"
        }
        else {
            error("emit_graphics_function called, but we're not in vert/frag for")
        }
        if (!this.stageInStructBegin.empty()) {
            stageInput = ", stage_input: StageInput"
        }
        if (!this.stageOutStructBegin.empty()) {
            maybeOutput = "-> StageOutput"
        }
        let signature = `
@${stageName}
fn main(${builtInInput} ${stageInput}) ${maybeOutput}
{
`
        this.funtionSignature.write(signature)
        this.functionEnd.write("\n}\n")
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

    getRawDataTypeName() {
        return "i32"
    }

    getAtomicRawDataTypeName() {
        return `atomic<${this.getRawDataTypeName()}>`
    }

    getRawDataTypeSize() {
        return 4
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
            case ResourceType.GlobalTmpsAtomic: {
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
        let binding: number
        if (!this.resourceBindings.has(buffer)) {
            binding = this.previousStageBindings.length + this.resourceBindings.size()
        }
        else {
            binding = this.resourceBindings.get(buffer)!
        }
        let elementType = this.getRawDataTypeName()
        switch (buffer.resourceType) {
            case ResourceType.Root: {
                name = `root_buffer_binding_${binding}`
                break;
            }
            case ResourceType.RootAtomic: {
                name = `root_buffer_atomic_binding_${binding}`
                elementType = this.getAtomicRawDataTypeName();
                break;
            }
            case ResourceType.GlobalTmps: {
                name = "global_tmps_";
                break;
            }
            case ResourceType.GlobalTmpsAtomic: {
                name = "global_tmps_atomic_";
                elementType = this.getAtomicRawDataTypeName();
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
            this.resourceBindings.add(buffer, binding)
            let elementCount = this.getElementCount(buffer)
            this.declareNewBuffer(buffer, name, binding, elementType, elementCount)
        }
        return name
    }

    isBufferWritable(buffer: ResourceInfo) {
        // vertex shader not allowed to write to global memory
        if (this.isVertexFor()) {
            return false
        }
        if (this.isFragmentFor()) {
            for (let vertexBinding of this.previousStageBindings) {
                if (vertexBinding.info.equals(buffer)) {
                    // fragment shader not allowed to bind as writable buffer, if the same buffer is also bound in vert shader
                    return false
                }
            }
            if (buffer.resourceType === ResourceType.Root || buffer.resourceType === ResourceType.RootAtomic) {
                let tree = this.runtime.materializedTrees[buffer.resourceID!]
                if (!tree.fragmentShaderWritable) {
                    return false
                }
            }
        }
        return true
    }

    assertBufferWritable(buffer: ResourceInfo) {
        // vertex shader not allowed to write to global memory
        if (this.isVertexFor()) {
            if (buffer.resourceType === ResourceType.GlobalTmps || buffer.resourceType === ResourceType.GlobalTmpsAtomic) {
                error("a vertex shader is not allowed to write to global temporary variables")
            }
            else if (buffer.resourceType === ResourceType.Root || buffer.resourceType === ResourceType.RootAtomic) {
                error("a vertex shader is not allowed to write to fields")
            }
            else {
                error("[Internal Error] Unexpected resource type")
            }
        }
        if (this.isFragmentFor()) {
            for (let vertexBinding of this.previousStageBindings) {
                if (vertexBinding.info.equals(buffer)) {
                    if (buffer.resourceType === ResourceType.GlobalTmps || buffer.resourceType === ResourceType.GlobalTmpsAtomic) {
                        error("a fragment shader is not allowed to write to global temporary variables, if the corresponding vertex shader reads any global temporary variable")
                    }
                    else if (buffer.resourceType === ResourceType.Root || buffer.resourceType === ResourceType.RootAtomic) {
                        let tree = this.runtime.materializedTrees[buffer.resourceID!]
                        if (tree.fragmentShaderWritable) {
                            error("[Internal Error] the vertex shader shouldn't have been able to read from the field which is marked as `fragmentShaderWritable`")
                        }
                        else {
                            error("[Internal Error] a fragment shader can only write to a field if it is marked as `fragmentShaderWritable`")
                        }
                    }
                    else {
                        error("[Internal Error] Unexpected resource type")
                    }
                }
            }
            if (buffer.resourceType === ResourceType.Root || buffer.resourceType === ResourceType.RootAtomic) {
                let tree = this.runtime.materializedTrees[buffer.resourceID!]
                if (!tree.fragmentShaderWritable) {
                    error("[Internal Error] a fragment shader can only write to a field if it is marked as `fragmentShaderWritable`")
                }
            }
        }
    }

    declareNewBuffer(buffer: ResourceInfo, name: string, binding: number, elementType: string, elementCount: number) {
        let storageAndAcess = "storage, read_write"
        if (!this.isBufferWritable(buffer)) {
            storageAndAcess = "storage, read";
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
        return this.getBufferName(buffer) + ".member"
    }

    getTextureName(textureInfo: ResourceInfo) {
        if (textureInfo.resourceType !== ResourceType.Texture && textureInfo.resourceType !== ResourceType.StorageTexture) {
            error("not a texture")
        }
        let binding: number
        if (!this.resourceBindings.has(textureInfo)) {
            binding = this.previousStageBindings.length + this.resourceBindings.size()
        }
        else {
            binding = this.resourceBindings.get(textureInfo)!
        }
        let isStorageTexture = (textureInfo.resourceType === ResourceType.StorageTexture)
        let texture = this.runtime.textures[textureInfo.resourceID!]
        let name: string
        if (isStorageTexture) {
            name = `texture_binding_${binding}`
        }
        else {
            name = `storage_texture_binding_${binding}`
        }
        let elementType = this.getPrimitiveTypeName(PrimitiveType.f32)
        let typeName = ""
        let isDepth = texture instanceof DepthTexture
        assert(!(isDepth && isStorageTexture), "cannot have depth storeage texture")
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
                    if (texture.sampleCount === 1) {
                        typeName = "texture_depth_2d"
                    }
                    else {
                        typeName = "texture_depth_multisampled_2d"
                    }
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
            this.resourceBindings.add(textureInfo, binding)
            let templateArgs = ""
            if (isStorageTexture) {
                templateArgs = `<${texture.getGPUTextureFormat() as string}, write>`
            }
            else if (isDepth) {
                templateArgs = ``
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
        this.globalDecls.write(decl)
    }

    getSamplerName(samplerInfo: ResourceInfo) {
        if (samplerInfo.resourceType !== ResourceType.Sampler) {
            error("not a sampler")
        }
        let binding: number
        if (!this.resourceBindings.has(samplerInfo)) {
            binding = this.previousStageBindings.length + this.resourceBindings.size()
        }
        else {
            binding = this.resourceBindings.get(samplerInfo)!
        }
        let texture = this.runtime.textures[samplerInfo.resourceID!]
        let name = `sampler_binding_${binding}`
        let typeName = "sampler"
        let isDepth = texture instanceof DepthTexture
        if (isDepth) {
            typeName = "sampler_comparison"
        }
        if (!this.resourceBindings.has(samplerInfo)) {
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
        this.globalDecls.write(decl)
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
    var state : RandState = ${randStatesMemberName}[id];
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

