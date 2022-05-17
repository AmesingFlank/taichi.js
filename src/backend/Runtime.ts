import { CompiledTask, CompiledKernel, TaskParams, ResourceType, KernelParams, ResourceBinding, CompiledRenderPipeline, RenderPipelineParams, CompiledRenderPassInfo } from './Kernel'
import { SNodeTree } from '../data/SNodeTree'
import { divUp, elementToInt32Array, int32ArrayToElement } from '../utils/Utils'
import { assert, error } from "../utils/Logging"
import { Field } from '../data/Field'
import { TypeCategory } from '../frontend/Type'
import { TextureBase, TextureDimensionality } from '../data/Texture'



class Runtime {
    adapter: GPUAdapter | null = null
    device: GPUDevice | null = null
    kernels: CompiledKernel[] = []
    materializedTrees: SNodeTree[] = []
    textures: TextureBase[] = []

    supportsIndirectFirstInstance: boolean = false

    private globalTmpsBuffer: GPUBuffer | null = null
    private randStatesBuffer: GPUBuffer | null = null

    constructor() { }

    async init() {
        await this.createDevice()
        this.createGlobalTmpsBuffer()
        this.createRandStatesBuffer()
    }

    async createDevice() {
        let alertWebGPUError = () => {
            alert(`Webgpu not supported. Please ensure that you have Chrome 100w+ with WebGPU Origin Trial Tokens, Chrome Canary, Firefox Nightly, or Safary Tech Preview`)
        }
        if (!navigator.gpu) {
            alertWebGPUError()
        }
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: "high-performance"
        });
        if (!adapter) {
            alertWebGPUError()
        }
        const requiredFeatures: GPUFeatureName[] = [];
        if (adapter!.features.has('indirect-first-instance')) {
            this.supportsIndirectFirstInstance = true
            requiredFeatures.push('indirect-first-instance')
        }

        const device = await adapter!.requestDevice({
            requiredFeatures
        });
        if (!device) {
            alertWebGPUError()
        }
        this.device = device
        this.adapter = adapter
    }

    createKernel(params: KernelParams): CompiledKernel {
        let kernel = new CompiledKernel()
        for (let taskParams of params.tasksParams) {
            if (taskParams instanceof TaskParams) {
                let task = new CompiledTask(taskParams, this.device!)
                kernel.tasks.push(task)
            }
            else if (taskParams instanceof RenderPipelineParams) {
                assert(params.renderPassParams !== null)
                let task = new CompiledRenderPipeline(taskParams, params.renderPassParams!, this.device!)
                kernel.tasks.push(task)
            }
        }
        if (params.renderPassParams !== null) {
            kernel.renderPassInfo = new CompiledRenderPassInfo(params.renderPassParams)
        }
        kernel.argTypes = params.argTypes
        kernel.returnType = params.returnType
        return kernel
    }

    async sync() {
        await this.device!.queue.onSubmittedWorkDone()
    }

    async launchKernel(kernel: CompiledKernel, ...args: any[]): Promise<any> {
        assert(args.length === kernel.argTypes.length,
            `Kernel requires ${kernel.argTypes.length} arguments, but ${args.length} is provided`)

        let requiresArgsBuffer = false
        let requiresRetsBuffer = false
        let thisArgsBuffer: GPUBuffer | null = null
        let thisRetsBuffer: GPUBuffer | null = null
        let argsSize: number = 0
        let retsSize: number = 0
        for (let task of kernel.tasks) {
            for (let binding of task.params.bindings) {
                if (binding.resourceType === ResourceType.Args) {
                    requiresArgsBuffer = true
                }
                if (binding.resourceType === ResourceType.Rets) {
                    requiresRetsBuffer = true
                }
            }
        }
        if (requiresArgsBuffer) {
            let numArgPrims = 0
            for (let type of kernel.argTypes) {
                numArgPrims += type.getPrimitivesList().length
            }

            let argData = new Int32Array(numArgPrims)
            let offset = 0
            for (let i = 0; i < args.length; ++i) {
                let type = kernel.argTypes[i]
                let thisArgData = elementToInt32Array(args[i], type)
                argData.set(thisArgData, offset)
                offset += type.getPrimitivesList().length
            }
            argsSize = numArgPrims * 4
            thisArgsBuffer = this.addArgsBuffer(argsSize)
            new Int32Array(thisArgsBuffer.getMappedRange()).set(argData)
            thisArgsBuffer.unmap()
        }

        if (requiresRetsBuffer) {
            retsSize = kernel.returnType.getPrimitivesList().length * 4
            thisRetsBuffer = this.addRetsBuffer(retsSize)
        }

        let commandEncoder = this.device!.createCommandEncoder();
        let computeEncoder: GPUComputePassEncoder | null = null
        let renderEncoder: GPURenderPassEncoder | null = null

        let endCompute = () => {
            if (computeEncoder) {
                computeEncoder.end()
            }
            computeEncoder = null
        }
        let endRender = () => {
            if (renderEncoder) {
                renderEncoder.end()
            }
            renderEncoder = null
        }
        let beginCompute = () => {
            endRender()
            if (!computeEncoder) {
                computeEncoder = commandEncoder.beginComputePass();
            }
        }
        let beginRender = () => {
            endCompute()
            if (!renderEncoder) {
                assert(kernel.renderPassInfo !== null, "render pass info is null")
                renderEncoder = commandEncoder.beginRenderPass(kernel.renderPassInfo!.getGPURenderPassDescriptor())
            }
        }



        let indirectPolyfills = new Map<CompiledRenderPipeline, IndirectPolyfillInfo>()
        for (let task of kernel.tasks) {
            if (task instanceof CompiledRenderPipeline) {
                if (task.params.indirectBuffer) {
                    if (task.params.indirectCount !== 1 || !this.supportsIndirectFirstInstance) {
                        let polyfill = new IndirectPolyfillInfo(task.params.indirectBuffer, task.params.indirectCount)
                        await polyfill.fillInfo()
                        indirectPolyfills.set(task, polyfill)
                    }
                }
            }
        }

        for (let task of kernel.tasks) {
            task.bindGroup = this.device!.createBindGroup({
                layout: task.pipeline!.getBindGroupLayout(0),
                entries: this.getGPUBindGroupEntries(task.params.bindings, thisArgsBuffer, thisRetsBuffer)
            })

            if (task instanceof CompiledTask) {
                beginCompute()
                computeEncoder!.setPipeline(task.pipeline!)
                computeEncoder!.setBindGroup(0, task.bindGroup!)
                // not sure if these are completely right hmm
                let workgroupSize = task.params.workgroupSize
                let numWorkGroups: number = 512
                if (workgroupSize === 1) {
                    numWorkGroups = 1
                }
                else if (task.params.rangeHint.length > 0) {
                    let invocations = 0
                    if (task.params.rangeHint.length > 4 && task.params.rangeHint.slice(0, 4) === "arg ") {
                        let argIndex = Number(task.params.rangeHint.slice(4))
                        invocations = args[argIndex]
                    }
                    else {
                        invocations = Number(task.params.rangeHint)
                    }
                    numWorkGroups = divUp(invocations, workgroupSize)
                }
                computeEncoder!.dispatch(numWorkGroups);
            }
            else if (task instanceof CompiledRenderPipeline) {
                beginRender()
                renderEncoder!.setPipeline(task.pipeline!)
                renderEncoder!.setBindGroup(0, task.bindGroup!)

                if (task.params.vertexBuffer) {
                    let vertexBufferTree = this.materializedTrees[task.params.vertexBuffer.snodeTree.treeId]
                    renderEncoder!.setVertexBuffer(0, vertexBufferTree.rootBuffer!, task.params.vertexBuffer.offsetBytes, task.params.vertexBuffer.sizeBytes)
                }

                if (task.params.indexBuffer) {
                    let indexBufferTree = this.materializedTrees[task.params.indexBuffer.snodeTree.treeId]
                    renderEncoder!.setIndexBuffer(indexBufferTree.rootBuffer!, "uint32", task.params.indexBuffer.offsetBytes, task.params.indexBuffer.sizeBytes)
                }
                if (!task.params.indirectBuffer) {
                    if (task.params.indexBuffer) {
                        renderEncoder!.drawIndexed(task.getVertexCount())
                    }
                    else {
                        renderEncoder!.draw(task.getVertexCount())
                    }
                }
                else {
                    if (task.params.indirectCount === 1 && this.supportsIndirectFirstInstance) {
                        let indirectBufferTree = this.materializedTrees[task.params.indirectBuffer.snodeTree.treeId]
                        renderEncoder!.drawIndexedIndirect(indirectBufferTree.rootBuffer!, task.params.indirectBuffer.offsetBytes)
                    }
                    else {
                        assert(indirectPolyfills.has(task))
                        let polyfill = indirectPolyfills.get(task)!
                        for (let draw of polyfill.commands) {
                            renderEncoder!.drawIndexed(draw.indexCount, draw.instanceCount, draw.firstIndex, draw.baseVertex, draw.firstInstance)
                        }
                    }
                }
            }
        }
        endCompute()
        endRender()
        this.device!.queue.submit([commandEncoder.finish()]);

        /**
         * launchKernel is an async function
         * when the user launches a kernel by writing `k()`, we don't await on the Promise returned by launchKernel
         * in other words, `k(); await.ti.sync();` is equivalent to `await k()`, assuming k has no return value
         * This is pretty neat. Should C++ taichi do the same? e.g. with C++ coroutines?
         */
        await this.sync()

        if (thisArgsBuffer) {
            thisArgsBuffer!.destroy()
        }

        if (kernel.returnType.getCategory() !== TypeCategory.Void) {
            assert(thisRetsBuffer !== null)

            let retsCopy = this.device!.createBuffer({
                size: retsSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            })
            let commandEncoder = this.device!.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(thisRetsBuffer!, 0, retsCopy, 0, retsSize)
            this.device!.queue.submit([commandEncoder.finish()]);
            await this.device!.queue.onSubmittedWorkDone()

            await retsCopy!.mapAsync(GPUMapMode.READ)
            let intArray = new Int32Array(retsCopy!.getMappedRange())
            let returnVal = int32ArrayToElement(intArray, kernel.returnType)

            thisRetsBuffer!.destroy()
            retsCopy.destroy()

            return returnVal
        }
    }

    addArgsBuffer(size: number): GPUBuffer {
        let buffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM,
            mappedAtCreation: true
        })
        return buffer
    }

    addRetsBuffer(size: number): GPUBuffer {
        let buf = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        })
        return buf
    }

    private createGlobalTmpsBuffer() {
        let size = 65536 // this buffer may be used as UBO by vertex shader. 65535 is the maximum size allowed by Chrome's WebGPU DX backend
        this.globalTmpsBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM,
        })
    }

    private createRandStatesBuffer() {
        this.randStatesBuffer = this.device!.createBuffer({
            size: 65536 * 4 * 4,
            usage: GPUBufferUsage.STORAGE
        })
    }

    getGPUBindGroupEntries(bindings: ResourceBinding[], argsBuffer: GPUBuffer | null, retsBuffer: GPUBuffer | null): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = []
        for (let binding of bindings) {
            let buffer: GPUBuffer | null = null
            let texture: GPUTextureView | null = null
            let sampler: GPUSampler | null = null
            switch (binding.resourceType) {
                case ResourceType.Root:
                case ResourceType.RootAtomic: {
                    buffer = this.materializedTrees[binding.resourceID!].rootBuffer!
                    break;
                }
                case ResourceType.GlobalTmps: {
                    buffer = this.globalTmpsBuffer!
                    break;
                }
                case ResourceType.Args: {
                    assert(argsBuffer !== null)
                    buffer = argsBuffer!
                    break;
                }
                case ResourceType.Rets: {
                    assert(retsBuffer !== null)
                    buffer = retsBuffer!
                    break;
                }
                case ResourceType.RandStates: {
                    buffer = this.randStatesBuffer!
                    break;
                }
                case ResourceType.Texture: {
                    texture = this.textures[binding.resourceID!].getGPUTextureView()
                    break;
                }
                case ResourceType.Sampler: {
                    sampler = this.textures[binding.resourceID!].getGPUSampler()
                    break;
                }
            }
            if (buffer !== null) {
                entries.push({
                    binding: binding.binding,
                    resource: {
                        buffer: buffer
                    }
                })
            }
            else if (texture !== null) {
                entries.push({
                    binding: binding.binding,
                    resource: texture
                })
            }
            else if (sampler !== null) {
                entries.push({
                    binding: binding.binding,
                    resource: sampler
                })
            }
            else {
                error("couldn't identify resource")
            }
        }
        return entries
    }

    materializeTree(tree: SNodeTree) {
        let size = tree.size
        // when a root buffer is used in vertex/fragment shader, we bind it as a uniform buffer, which requries the data to be 16-byte aligned
        // the element is vec4<i32>, so we need to ensure that the buffer size is a multiple of 16
        if (size % 16 !== 0) {
            size += 16 - (size % 16)
        }
        let rootBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC | GPUBufferUsage.INDIRECT,
        })
        tree.rootBuffer = rootBuffer
        this.materializedTrees.push(tree)
    }

    addTexture(texture: TextureBase) {
        this.textures.push(texture)
    }

    createGPUTexture(dimensions: number[], dimensionality: TextureDimensionality, format: GPUTextureFormat, renderAttachment: boolean, requiresStorage: boolean, sampleCount: number): GPUTexture {
        let getDescriptor = (): GPUTextureDescriptor => {
            let usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
            if (requiresStorage) {
                usage = usage | GPUTextureUsage.STORAGE_BINDING;
            }
            if (dimensions.length === 1) {
                error("1d texture not supported yet")
                return {
                    size: { width: dimensions[0] },
                    dimension: "1d",
                    format: format,
                    usage: usage
                }
            }
            else if (dimensions.length === 2) {
                assert(dimensionality === TextureDimensionality.Dim2d || dimensionality === TextureDimensionality.DimCube)
                if (renderAttachment) {
                    usage = usage | GPUTextureUsage.RENDER_ATTACHMENT
                }
                let size: GPUExtent3DStrict = { width: dimensions[0], height: dimensions[1] }
                if (dimensionality === TextureDimensionality.DimCube) {
                    size.depthOrArrayLayers = 6
                }
                return {
                    size: size,
                    dimension: "2d",
                    format: format,
                    usage: usage,
                    sampleCount
                }
            }
            else {// if(dimensions.length === 3){ 
                return {
                    size: { width: dimensions[0], height: dimensions[1], depthOrArrayLayers: dimensions[2] },
                    dimension: "3d",
                    format: format,
                    usage: usage
                }
            }
        }
        return this.device!.createTexture(getDescriptor())
    }

    createGPUSampler(depth: boolean): GPUSampler {
        let desc: GPUSamplerDescriptor = {
            addressModeU:"repeat",
            addressModeV:"repeat",
            addressModeW:"repeat",
            minFilter:"linear",
            magFilter:"linear",
            mipmapFilter:"linear",
            maxAnisotropy:16
        }
        if (depth) {
            desc.compare = "less"
        }
        return this.device!.createSampler(desc)
    }

    createGPUCanvasContext(htmlCanvas: HTMLCanvasElement): [GPUCanvasContext, GPUTextureFormat] {
        let context = htmlCanvas.getContext('webgpu')
        if (context === null) {
            error("canvas webgpu context is null")
        }
        let presentationFormat = context!.getPreferredFormat(this.adapter!)

        context!.configure({
            device: this.device!,
            format: presentationFormat,
        })
        return [context!, presentationFormat]
    }

    async deviceToHost(field: Field, offsetBytes: number = 0, sizeBytes: number = 0): Promise<FieldHostSideCopy> {
        if (sizeBytes === 0) {
            sizeBytes = field.sizeBytes
        }
        const rootBufferCopy = this.device!.createBuffer({
            size: sizeBytes,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.materializedTrees[field.snodeTree.treeId].rootBuffer!, field.offsetBytes + offsetBytes, rootBufferCopy, 0, sizeBytes)
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.sync()

        await rootBufferCopy.mapAsync(GPUMapMode.READ)
        let mappedRange = rootBufferCopy.getMappedRange()
        let resultInt = Array.from(new Int32Array(mappedRange))
        let resultFloat = Array.from(new Float32Array(mappedRange))
        rootBufferCopy.unmap()
        rootBufferCopy.destroy()
        return new FieldHostSideCopy(resultInt, resultFloat)
    }

    async hostToDevice(field: Field, hostArray: Int32Array, offsetBytes: number = 0) {
        const rootBufferCopy = this.device!.createBuffer({
            size: hostArray.byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            mappedAtCreation: true,
        });

        new Int32Array(rootBufferCopy.getMappedRange()).set(hostArray)
        rootBufferCopy.unmap()

        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(rootBufferCopy, 0, this.materializedTrees[field.snodeTree.treeId].rootBuffer!, field.offsetBytes + offsetBytes, hostArray.byteLength)
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.device!.queue.onSubmittedWorkDone()

        rootBufferCopy.destroy()
    }

    getRootBuffer(treeId: number): GPUBuffer {
        return this.materializedTrees[treeId].rootBuffer!
    }
    async copyImageBitmapToTexture(bitmap: ImageBitmap, texture: GPUTexture) {
        let copySource: GPUImageCopyExternalImage = {
            source: bitmap
        }
        let copyDest: GPUImageCopyTextureTagged = {
            texture: texture
        }
        let extent: GPUExtent3D = {
            width: bitmap.width,
            height: bitmap.height
        }
        this.device!.queue.copyExternalImageToTexture(copySource, copyDest, extent)
        await this.device!.queue.onSubmittedWorkDone()
    }
    async copyImageBitmapsToCubeTexture(bitmaps: ImageBitmap[], texture: GPUTexture) {
        for (let i = 0; i < 6; ++i) {
            let bitmap = bitmaps[i]
            let copySource: GPUImageCopyExternalImage = {
                source: bitmap
            }
            let copyDest: GPUImageCopyTextureTagged = {
                texture: texture,
                origin: [0, 0, i]
            }
            let extent: GPUExtent3D = {
                width: bitmap.width,
                height: bitmap.height
            }
            this.device!.queue.copyExternalImageToTexture(copySource, copyDest, extent)
        }
        await this.device!.queue.onSubmittedWorkDone()
    }
}

class FieldHostSideCopy {
    constructor(
        public intArray: number[],
        public floatArray: number[]
    ) {

    }
}

class IndirectDrawCommand {
    constructor(
        public indexCount: number,
        public instanceCount: number,
        public firstIndex: number,
        public baseVertex: number,
        public firstInstance: number
    ) {

    }
}

class IndirectPolyfillInfo {
    constructor(public indirectBuffer: Field, public indirectCount: number | Field) {

    }
    commands: IndirectDrawCommand[] = []
    async fillInfo() {
        if (this.indirectCount instanceof Field) {
            this.indirectCount = (await this.indirectCount.toInt32Array())[0]
        }
        let indirectBufferHost = await this.indirectBuffer.toInt32Array()
        this.commands = []
        for (let i = 0; i < this.indirectCount; ++i) {
            let values = indirectBufferHost.slice(i * 5, i * 5 + 5)
            let cmd = new IndirectDrawCommand(values[0], values[1], values[2], values[3], values[4])
            this.commands.push(cmd)
        }
    }
}
export { Runtime }