import { CompiledTask, CompiledKernel, TaskParams, BufferType, KernelParams, BufferBinding, CompiledRenderPipeline, RenderPipelineParams, CompiledRenderPassInfo } from './Kernel'
import { SNodeTree } from '../program/SNodeTree'
import { divUp, elementToInt32Array, int32ArrayToElement } from '../utils/Utils'
import { assert, error } from "../utils/Logging"
import { Field, Texture, TextureBase } from '../program/Field'
import { PrimitiveType, TypeCategory, TypeUtils } from '../frontend/Type'
class MaterializedTree {
    tree?: SNodeTree
    rootBuffer?: GPUBuffer
    device?: GPUDevice
}

class FieldHostSideCopy {
    constructor(
        public intArray: number[],
        public floatArray: number[]
    ) {

    }
}

class Runtime {
    adapter: GPUAdapter | null = null
    device: GPUDevice | null = null
    kernels: CompiledKernel[] = []
    private materializedTrees: MaterializedTree[] = []
    private textures: TextureBase[] = []

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
            alert(`Webgpu not supported. Please ensure that you have Chrome 98+ with WebGPU Origin Trial Tokens, Chrome Canary, Firefox Nightly, or Safary Tech Preview`)
        }
        if (!navigator.gpu) {
            alertWebGPUError()
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            alertWebGPUError()
        }
        const device = await adapter!.requestDevice();
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
        if(params.renderPassParams !== null){
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
                if (binding.bufferType === BufferType.Args) {
                    requiresArgsBuffer = true
                }
                if (binding.bufferType === BufferType.Rets) {
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
                computeEncoder.endPass()
            }
            computeEncoder = null
        }
        let endRender = () => {
            if (renderEncoder) {
                renderEncoder.endPass()
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
                renderEncoder = commandEncoder.beginRenderPass(kernel.renderPassInfo!.gpuRenderPassDescriptor)
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

                if (task.params.vertex.VBO) {
                    let vboTree = this.materializedTrees[task.params.vertex.VBO.snodeTree.treeId]
                    renderEncoder!.setVertexBuffer(0, vboTree.rootBuffer!, task.params.vertex.VBO.offsetBytes, task.params.vertex.VBO.sizeBytes)
                }

                if (task.params.vertex.IBO) {
                    let iboTree = this.materializedTrees[task.params.vertex.IBO.snodeTree.treeId]
                    renderEncoder!.setIndexBuffer(iboTree.rootBuffer!, "uint32", task.params.vertex.IBO.offsetBytes, task.params.vertex.IBO.sizeBytes)
                }

                if (task.params.vertex.IBO) {
                    renderEncoder!.drawIndexed(task.getVertexCount())
                }
                else {
                    renderEncoder!.draw(task.getVertexCount())
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

    getGPUBindGroupEntries(bindings: BufferBinding[], argsBuffer: GPUBuffer | null, retsBuffer: GPUBuffer | null): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = []
        for (let binding of bindings) {
            let buffer: GPUBuffer | null = null
            switch (binding.bufferType) {
                case BufferType.Root: {
                    buffer = this.materializedTrees[binding.rootID!].rootBuffer!
                    break;
                }
                case BufferType.GlobalTmps: {
                    buffer = this.globalTmpsBuffer!
                    break;
                }
                case BufferType.Args: {
                    assert(argsBuffer !== null)
                    buffer = argsBuffer!
                    break;
                }
                case BufferType.Rets: {
                    assert(retsBuffer !== null)
                    buffer = retsBuffer!
                    break;
                }
                case BufferType.RandStates: {
                    buffer = this.randStatesBuffer!
                    break;
                }
            }
            assert(buffer !== null, "couldn't find buffer to bind")
            entries.push({
                binding: binding.binding,
                resource: {
                    buffer: buffer
                }
            })
        }
        return entries
    }

    materializeTree(tree: SNodeTree) {
        let size = tree.size
        let rootBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })
        let device = this.device!
        let materialized: MaterializedTree = {
            tree,
            rootBuffer,
            device
        }
        this.materializedTrees.push(materialized)
    }

    addTexture(texture: TextureBase) {
        let id = this.textures.length
        this.textures.push(texture)
        return id
    }

    createGPUTexture(dimensions: number[], format: GPUTextureFormat, renderAttachment: boolean): GPUTexture {
        let getDescriptor = (): GPUTextureDescriptor => {
            let defaultUsage = GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
            if (dimensions.length === 1) {
                return {
                    size: { width: dimensions[0] },
                    dimension: "1d",
                    format: format,
                    usage: defaultUsage
                }
            }
            else if (dimensions.length === 2) {
                let usage = defaultUsage
                if (renderAttachment) {
                    usage = usage | GPUTextureUsage.RENDER_ATTACHMENT
                }
                return {
                    size: { width: dimensions[0], height: dimensions[1] },
                    dimension: "2d",
                    format: format,
                    usage: usage
                }
            }
            else {// if(dimensions.length === 2){
                return {
                    size: { width: dimensions[0], height: dimensions[1], depthOrArrayLayers: dimensions[2] },
                    dimension: "3d",
                    format: format,
                    usage: defaultUsage
                }
            }
        }
        return this.device!.createTexture(getDescriptor())
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
        await this.sync()

        rootBufferCopy.destroy()
    }

    getRootBuffer(treeId: number): GPUBuffer {
        return this.materializedTrees[treeId].rootBuffer!
    }
}

export { Runtime }