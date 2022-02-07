import { CompiledTask, CompiledKernel, TaskParams, BufferType, KernelParams } from './Kernel'
import { SNodeTree } from '../program/SNodeTree'
import { divUp } from '../utils/Utils'
import {RootBufferRenderer} from './RenderRootBuffer'
import {assert} from "../utils/Logging"
import { Field } from '../program/Field'
import { PrimitiveType } from '../frontend/Type'
class MaterializedTree {
    tree?: SNodeTree
    rootBuffer?: GPUBuffer
    device?: GPUDevice
}

class Runtime {
    adapter: GPUAdapter|null = null
    device: GPUDevice|null = null
    kernels: CompiledKernel[] = []
    private materializedTrees: MaterializedTree[] = []

    private globalTmpsBuffer: GPUBuffer | null = null
    private contextBuffers: GPUBuffer[] = []

    constructor(){}

    async init(){
        await this.createDevice()
        this.createGlobalTmpsBuffer()
    }

    async createDevice() {
        if (navigator.gpu === undefined){
            alert("Webgpu not supported")
        }
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter!.requestDevice();
        this.device = device
        this.adapter = adapter
    }

    private createGlobalTmpsBuffer(){
        let size = 1024 * 1024
        this.globalTmpsBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE,
        })
    }

    createTask(params:TaskParams): CompiledTask {
        let task = new CompiledTask(this.device!,params)
        return task
    }

    createKernel(params:KernelParams): CompiledKernel {
        let kernel = new CompiledKernel(this.device!)
        for(let taskParams of params.taskParams){
            let task = this.createTask(taskParams)
            kernel.tasks.push(task)
        }
        kernel.numArgs = params.numArgs
        return kernel
    }

    async sync(){
        await this.device!.queue.onSubmittedWorkDone()
        for(let buffer of this.contextBuffers){
            buffer.destroy()
        }
        this.contextBuffers = []
    }

    launchKernel(kernel: CompiledKernel, ...args:any[]){
        assert(args.length === kernel.numArgs, 
            "Kernel requires "+kernel.numArgs.toString()+" arguments, but "+args.length.toString()+" is provided")
        
        if(kernel.numArgs > 0){
            let ctxBuffer = this.addContextBuffer(kernel.numArgs)
            new Float32Array(ctxBuffer.getMappedRange()).set(new Float32Array(args))
            ctxBuffer.unmap()
        }

        let commandEncoder = this.device!.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();

        for(let task of kernel.tasks){
            if(task.bindGroup === null){
                task.bindGroup = this.device!.createBindGroup({
                    layout: task.pipeline!.getBindGroupLayout(0),
                    entries: this.getBindings(task.params)
                })
            }
            passEncoder.setPipeline(task.pipeline!);
            passEncoder.setBindGroup(0, task.bindGroup);
            // not sure if these are completely right hmm
            let workgroupSize = task.params.workgroupSize 
            let numWorkGroups:number = 512
            if(workgroupSize === 1){
                numWorkGroups = 1
            }
            else if(task.params.rangeHint.length > 0){
                let invocations = 0
                if(task.params.rangeHint.length > 4 && task.params.rangeHint.slice(0,4) === "arg "){
                    let argIndex = Number(task.params.rangeHint.slice(4))
                    invocations = args[argIndex]
                }
                else{
                    invocations = Number(task.params.rangeHint)
                }
                numWorkGroups = divUp(invocations , workgroupSize)
            }
            passEncoder.dispatch(numWorkGroups);
        }
        passEncoder.endPass();
        this.device!.queue.submit([commandEncoder.finish()]);
    }

    addContextBuffer(numArgs: number):GPUBuffer{
        let size = numArgs * 4
        let buffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE ,
            mappedAtCreation : true
        })
        this.contextBuffers.push(buffer)
        return buffer
    }

    getBindings(task:TaskParams): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = []
        for(let binding of task.bindings){
            let buffer:GPUBuffer|null = null
            switch(binding.bufferType){
                case BufferType.Root:{
                    buffer = this.materializedTrees[binding.rootID!].rootBuffer!
                    break;
                }
                case BufferType.GlobalTmps:{
                    buffer = this.globalTmpsBuffer!
                    break;
                }
                case BufferType.Context:{
                    buffer = this.contextBuffers[this.contextBuffers.length-1]
                    break;
                }
            }
            assert(buffer !== null, "couldn't find buffer to bind")
            entries.push({
                binding:binding.binding,
                resource:{
                    buffer:buffer
                }
            })
        }
        return entries
    }

    materializeTree(tree:SNodeTree){
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

    async copyFieldToHost(field: Field) : Promise<number[]> {
        let size = field.size
        const rootBufferCopy = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.materializedTrees[field.snodeTree.treeId].rootBuffer!, field.offset,rootBufferCopy,0,size)
        this.device!.queue.submit([commandEncoder.finish()]);
        this.sync()
    
        await rootBufferCopy.mapAsync(GPUMapMode.READ)
        let result1D: number[] = []
        if(field.elementType.primitiveType === PrimitiveType.i32){
            let hostBuffer = new Int32Array(rootBufferCopy.getMappedRange())
            result1D = Array.from(hostBuffer)
        }else{
            let hostBuffer = new Float32Array(rootBufferCopy.getMappedRange())
            result1D = Array.from(hostBuffer)
        }
        return result1D
    }

    async getRootBufferRenderer(canvas:HTMLCanvasElement, treeId:number):Promise<RootBufferRenderer> {
        let renderer = new RootBufferRenderer(this.adapter!,this.device!,this.materializedTrees[treeId].rootBuffer!)
        await renderer.initForCanvas(canvas)
        return renderer
    }
}

export {Runtime}