import { CompiledTask, CompiledKernel, TaskParams, BufferType, KernelParams } from './Kernel'
import { SNodeTree } from '../program/SNodeTree'
import { divUp, int32ArrayToElement } from '../utils/Utils'
import { assert, error } from "../utils/Logging"
import { Field } from '../program/Field'
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
            alert(`Webgpu not supported. Please ensure that you have Chrome 94+ with WebGPU Origin Trial Tokens, Chrome Canary, Firefox Nightly, or Safary Tech Preview`)
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

    createTask(params: TaskParams): CompiledTask {
        let task = new CompiledTask(this.device!, params)
        return task
    }

    createKernel(params: KernelParams): CompiledKernel {
        let kernel = new CompiledKernel(this.device!)
        for (let taskParams of params.taskParams) {
            let task = this.createTask(taskParams)
            kernel.tasks.push(task)
        }
        kernel.numArgs = params.numArgs
        kernel.returnType = params.returnType
        return kernel
    }

    async sync() {
        await this.device!.queue.onSubmittedWorkDone()
    }

    async launchKernel(kernel: CompiledKernel, ...args: any[]) : Promise<any>{
        assert(args.length === kernel.numArgs,
            "Kernel requires " + kernel.numArgs.toString() + " arguments, but " + args.length.toString() + " is provided")

        for (let a of args) {
            assert(typeof a === "number", "Kernel argument must be numbers")
        }

        let requiresArgsBuffer = false
        let requiresRetsBuffer = false
        let thisArgsBuffer : GPUBuffer | null = null
        let thisRetsBuffer : GPUBuffer | null = null
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
            let argsSize = 4 * kernel.numArgs
            thisArgsBuffer = this.addArgsBuffer(argsSize)
            if (kernel.numArgs > 0) {
                new Float32Array(thisArgsBuffer.getMappedRange()).set(new Float32Array(args))
            }
            thisArgsBuffer.unmap()
        }
       
        if (requiresRetsBuffer) {
            let argsSize = kernel.returnType.getPrimitivesList().length * 4
            thisRetsBuffer = this.addRetsBuffer(argsSize)
        }

        let commandEncoder = this.device!.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        for (let task of kernel.tasks) {
            task.bindGroup = this.device!.createBindGroup({
                layout: task.pipeline!.getBindGroupLayout(0),
                entries: this.getBindings(task.params,thisArgsBuffer,thisRetsBuffer)
            })

            passEncoder.setPipeline(task.pipeline!);
            passEncoder.setBindGroup(0, task.bindGroup);
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
            passEncoder.dispatch(numWorkGroups);
        }
        passEncoder.endPass();
        this.device!.queue.submit([commandEncoder.finish()]);

        /**
         * launchKernel is an async function
         * when the user launches a kernel by writing `k()`, we don't await on the Promise returned by launchKernel
         * in other words, `k(); await.ti.sync();` is equivalent to `await k()`, assuming k has no return value
         * This is pretty neat. Should C++ taichi do the same? e.g. with C++ coroutines?
         */
        await this.sync()

        if(thisArgsBuffer){
            thisArgsBuffer!.destroy()
        }

        if(kernel.returnType.getCategory() !== TypeCategory.Void){
            assert(thisRetsBuffer!== null)
            await thisRetsBuffer!.mapAsync(GPUMapMode.READ)
            let intArray = new Int32Array(thisRetsBuffer!.getMappedRange())
            let returnVal = int32ArrayToElement(intArray, kernel.returnType)
            thisRetsBuffer!.destroy()
            return returnVal
        }
    }

    addArgsBuffer(size: number): GPUBuffer {
        let buffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true
        }) 
        return buffer
    }

    addRetsBuffer(size: number): GPUBuffer {
        let buf = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.MAP_READ
        })
        return buf
    }

    private createGlobalTmpsBuffer() {
        let size = 1024 * 1024
        this.globalTmpsBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE,
        })
    }

    private createRandStatesBuffer() {
        this.randStatesBuffer = this.device!.createBuffer({
            size: 65536 * 4 * 4,
            usage: GPUBufferUsage.STORAGE
        })
    }

    getBindings(task: TaskParams, argsBuffer:GPUBuffer|null, retsBuffer:GPUBuffer | null): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = []
        for (let binding of task.bindings) {
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
                    assert(argsBuffer!==null)
                    buffer = argsBuffer!
                    break;
                }
                case BufferType.Rets: {
                    assert(retsBuffer!==null)
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
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        })
        let device = this.device!
        let materialized: MaterializedTree = {
            tree,
            rootBuffer,
            device
        }
        this.materializedTrees.push(materialized)
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