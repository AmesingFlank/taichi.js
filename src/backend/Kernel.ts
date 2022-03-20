import { PrimitiveType, Type, VoidType } from "../frontend/Type"
import { nativeTaichi, NativeTaichiAny } from "../native/taichi/GetTaichi"
import { Field, Texture } from "../program/Field"
import { assert, error } from "../utils/Logging"
enum BufferType {
    Root, GlobalTmps, Args, RandStates, Rets
}

class BufferBinding {
    constructor(
        public bufferType: BufferType,
        public rootID: number | null,
        public binding: number
    ) { }

    equals(that: BufferBinding): boolean {
        return this.bufferType === that.bufferType && this.rootID === that.rootID && this.binding === that.binding
    }
}

// compute shader
class TaskParams {
    constructor(
        public code: string,
        public rangeHint: string,
        public workgroupSize: number,
        public bindings: BufferBinding[] = []
    ) {

    }
}
class VertexShaderParams {
    constructor(
        public code: string = "",
        public VBO: Field | null = null,
        public bindings: BufferBinding[] = [],
        public IBO: Field | null = null
    ) {

    }
}

class FragmentShaderParams {
    constructor(
        public code: string = "",
        public bindings: BufferBinding[] = [],
        public outputTexutres: Texture[] = []
    ) {

    }
}

class RenderPipelineParams {
    constructor(
        public vertex: VertexShaderParams,
        public fragment: FragmentShaderParams,
        public interpolatedType: Type | null = null
    ) {
        this.bindings = this.getBindings()
    }

    public bindings: BufferBinding[]

    private getBindings() {
        let bindings: BufferBinding[] = []
        let candidates = this.vertex.bindings.concat(this.fragment.bindings)
        for (let c of candidates) {
            let found = false
            for (let b of bindings) {
                if (c.equals(b)) {
                    found = true
                    break
                }
            }
            if (!found) {
                bindings.push(c)
            }
        }
        return bindings
    }
}

class KernelParams {
    constructor(
        public tasksParams: (TaskParams | RenderPipelineParams)[],
        public numArgs: number,
        public returnType: Type
    ) {

    }
}

class CompiledTask {
    pipeline: GPUComputePipeline | null = null
    bindGroup: GPUBindGroup | null = null
    constructor(public params: TaskParams, device: GPUDevice) {
        this.createPipeline(device)
    }
    createPipeline(device: GPUDevice) {
        let code = this.params.code
        this.pipeline = device.createComputePipeline({
            compute: {
                module: device.createShaderModule({
                    code: code,
                }),
                entryPoint: 'main',
            },
        })
    }
}

class CompiledRenderPipeline {
    pipeline: GPURenderPipeline | null = null
    bindGroup: GPUBindGroup | null = null
    constructor(public params: RenderPipelineParams, device: GPUDevice) {
        this.createPipeline(device)
    }

    private getGPUVertexBufferStates(): GPUVertexBufferLayout {
        let attrs: GPUVertexAttribute[] = []
        let vertexInputType = this.params.vertex.VBO!.elementType
        let prims = vertexInputType.getPrimitivesList()
        let getPrimFormat = (prim: PrimitiveType): GPUVertexFormat => {
            if (prim === PrimitiveType.f32) {
                return "float32"
            }
            else if (prim === PrimitiveType.i32) {
                return "sint32"
            }
            else {
                error("unrecongnized prim")
                return "float32"
            }
        }
        for (let i = 0; i < prims.length; ++i) {
            attrs.push(
                {
                    shaderLocation: i,
                    format: getPrimFormat(prims[i]),
                    offset: i * 4,
                },
            )
        }
        return {
            arrayStride: prims.length * 4,
            attributes: attrs
        }
    }
    private getGPUColorTargetStates(): GPUColorTargetState[] {
        let result: GPUColorTargetState[] = []
        for (let tex of this.params.fragment.outputTexutres) {
            result.push({
                format: tex.getGPUTextureFormat()
            })
        }
        return result
    }
    public getGPURenderPassDescriptor(): GPURenderPassDescriptor {
        let colorAttachments: GPURenderPassColorAttachment[] = []
        for (let tex of this.params.fragment.outputTexutres) {
            colorAttachments.push(
                {
                    view: tex.getGPUTexture().createView(),
                    loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: 'store',
                }
            )
        }
        return {
            colorAttachments
        }
    }
    getVertexCount(): number {
        if (this.params.vertex.IBO) {
            return this.params.vertex.IBO.dimensions[0]
        }
        else {
            return this.params.vertex.VBO!.dimensions[0]
        }
    }
    createPipeline(device: GPUDevice) {
        this.pipeline = device.createRenderPipeline({
            vertex: {
                module: device.createShaderModule({
                    code: this.params.vertex.code,
                }),
                entryPoint: 'main',
                buffers: [
                    this.getGPUVertexBufferStates()
                ],
            },
            fragment: {
                module: device.createShaderModule({
                    code: this.params.fragment.code,
                }),
                entryPoint: 'main',
                targets: this.getGPUColorTargetStates()
            },
            primitive: {
                topology: 'triangle-list',
                stripIndexFormat: undefined,
            },
        })
    }
}

class CompiledKernel {
    constructor(
        public tasks: (CompiledTask | CompiledRenderPipeline)[] = [],
        public numArgs: number = 0,
        public returnType: Type = new VoidType()
    ) {

    }
}

export { CompiledTask, CompiledKernel, TaskParams, BufferType, BufferBinding, KernelParams, VertexShaderParams, FragmentShaderParams, RenderPipelineParams, CompiledRenderPipeline }