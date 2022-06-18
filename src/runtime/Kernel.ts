import { PrimitiveType, StructType, Type, VoidType } from "../language/frontend/Type"
import { CanvasTexture, DepthTexture, TextureBase } from "../data/Texture"
import { Field } from "../data/Field"

import { error } from "../utils/Logging"
enum ResourceType {
    Root, RootAtomic, GlobalTmps, Args, RandStates, Rets, Texture, Sampler, StorageTexture
}

class ResourceInfo {
    constructor(
        public resourceType: ResourceType,
        public resourceID?: number
    ) { }

    equals(that: ResourceInfo): boolean {
        return this.resourceID === that.resourceID && this.resourceType === that.resourceType
    }
}
class ResourceBinding {
    constructor(
        public info: ResourceInfo,
        public binding: number
    ) { }

    equals(that: ResourceBinding): boolean {
        return this.info.equals(that.info) && this.binding === that.binding
    }
}

// compute shader
class TaskParams {
    constructor(
        public code: string,
        public workgroupSize: number,
        public numWorkgroups: number,
        public bindings: ResourceBinding[] = []
    ) {

    }
}
class VertexShaderParams {
    constructor(
        public code: string = "",
        public bindings: ResourceBinding[] = [],

    ) {

    }
}

class FragmentShaderParams {
    constructor(
        public code: string = "",
        public bindings: ResourceBinding[] = [],
    ) {

    }
}

class RenderPipelineParams {
    constructor(
        public vertex: VertexShaderParams,
        public fragment: FragmentShaderParams,
        public interpolatedType: Type = new StructType({}),
        public vertexBuffer: Field | null = null,
        public indexBuffer: Field | null = null,
        public indirectBuffer: Field | null = null
    ) {
        this.bindings = this.getBindings()
    }

    public bindings: ResourceBinding[]
    public indirectCount: number | Field = 1

    public getBindings() {
        let bindings: ResourceBinding[] = []
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

interface ColorAttachment {
    texture: TextureBase,
    clearColor?: number[],
}

interface DepthAttachment {
    texture: DepthTexture,
    clearDepth?: number
    storeDepth?: boolean
}

interface RenderPassParams {
    colorAttachments: ColorAttachment[]
    depthAttachment: DepthAttachment | null
}

class KernelParams {
    constructor(
        public tasksParams: (TaskParams | RenderPipelineParams)[],
        public argTypes: Type[],
        public returnType: Type,
        public renderPassParams: RenderPassParams | null = null
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
    constructor(public params: RenderPipelineParams, renderPassParams: RenderPassParams, device: GPUDevice) {
        this.createPipeline(device, renderPassParams)
    }

    private getGPUVertexBufferStates(): GPUVertexBufferLayout {
        let attrs: GPUVertexAttribute[] = []
        let vertexInputType = this.params.vertexBuffer!.elementType
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
    private getGPUColorTargetStates(renderPassParams: RenderPassParams): GPUColorTargetState[] {
        let result: GPUColorTargetState[] = []
        for (let tex of renderPassParams.colorAttachments) {
            result.push({
                format: tex.texture.getGPUTextureFormat()
            })
        }
        return result
    }
    getVertexCount(): number {
        if (this.params.indexBuffer) {
            return this.params.indexBuffer.dimensions[0]
        }
        else {
            return this.params.vertexBuffer!.dimensions[0]
        }
    }
    createPipeline(device: GPUDevice, renderPassParams: RenderPassParams) {
        let sampleCount = 1
        if (renderPassParams.colorAttachments.length > 0) {
            sampleCount = renderPassParams.colorAttachments[0].texture.sampleCount
        }
        else if (renderPassParams.depthAttachment !== null) {
            sampleCount = renderPassParams.depthAttachment.texture.sampleCount
        }
        for (let attachment of renderPassParams.colorAttachments) {
            if (attachment.texture.sampleCount != sampleCount) {
                error("all render target attachments (color or depth) must have the same sample count")
            }
        }
        if (renderPassParams.depthAttachment !== null && renderPassParams.depthAttachment.texture.sampleCount !== sampleCount) {
            error("all render target attachments (color or depth) must have the same sample count")
        }
        let desc: GPURenderPipelineDescriptor = {
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
                targets: this.getGPUColorTargetStates(renderPassParams)
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: "none"
            },
            multisample: {
                count: sampleCount
            }
        }
        if (renderPassParams.depthAttachment !== null) {
            let depthWrite = true
            if (renderPassParams.depthAttachment.storeDepth === false) {
                depthWrite = false
            }
            desc.depthStencil = {
                depthWriteEnabled: depthWrite,
                depthCompare: 'less',
                format: renderPassParams.depthAttachment.texture.getGPUTextureFormat(),
            }
        }
        this.pipeline = device.createRenderPipeline(desc)
    }
}

class CompiledRenderPassInfo {
    constructor(
        public params: RenderPassParams
    ) {
    }

    public getGPURenderPassDescriptor(): GPURenderPassDescriptor {
        let colorAttachments: GPURenderPassColorAttachment[] = []
        for (let attach of this.params.colorAttachments) {
            let view: GPUTextureView = attach.texture.getGPUTextureView()
            let resolveTarget: GPUTextureView | undefined = undefined
            if (attach.texture.sampleCount > 1) {
                if (attach.texture instanceof CanvasTexture) {
                    view = attach.texture.renderTexture!.createView()
                    resolveTarget = attach.texture.getGPUTextureView()
                }
            }
            if (attach.clearColor === undefined) {
                colorAttachments.push(
                    {
                        view,
                        resolveTarget,
                        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                        loadValue: "load",
                        loadOp: "load",
                        storeOp: 'store',
                    }
                )
            }
            else {
                let clearValue = {
                    r: attach.clearColor[0],
                    g: attach.clearColor[1],
                    b: attach.clearColor[2],
                    a: attach.clearColor[3]
                }
                colorAttachments.push(
                    {
                        view,
                        resolveTarget,
                        clearValue: clearValue,
                        loadValue: clearValue,
                        loadOp: "clear",
                        storeOp: 'store',
                    }
                )
            }

        }
        let depth = this.params.depthAttachment
        if (depth === null) {
            return {
                colorAttachments
            }
        }
        let depthStencilAttachment: GPURenderPassDepthStencilAttachment = {
            view: depth.texture.getGPUTextureView(),
            depthClearValue: depth.clearDepth,
            depthLoadValue: depth.clearDepth === undefined ? "load" : depth.clearDepth,
            depthLoadOp: depth.clearDepth === undefined ? "load" : "clear",
            depthStoreOp: depth.storeDepth === true ? "store" : "discard",
        }
        return {
            colorAttachments,
            depthStencilAttachment
        }
    }

}
class CompiledKernel {
    constructor(
        public tasks: (CompiledTask | CompiledRenderPipeline)[] = [],
        public argTypes: Type[] = [],
        public returnType: Type = new VoidType(),
        public renderPassInfo: CompiledRenderPassInfo | null = null
    ) {

    }
}

export { CompiledTask, CompiledKernel, TaskParams, ResourceType, ResourceInfo, ResourceBinding, KernelParams, VertexShaderParams, FragmentShaderParams, RenderPipelineParams, CompiledRenderPipeline, RenderPassParams, ColorAttachment, DepthAttachment, CompiledRenderPassInfo }