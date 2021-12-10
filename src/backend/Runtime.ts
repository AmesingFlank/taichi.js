import { CompiledTask, CompiledKernel, TaskParams } from './Kernel'
import { SNodeTree } from '../program/SNodeTree'
import { divUp } from '../utils/Utils'
import {RootBufferRenderer} from './RenderRootBuffer'

class MaterializedTree {
    tree?: SNodeTree
    rootBuffer?: GPUBuffer
    device?: GPUDevice
}

class Runtime {
    adapter: GPUAdapter|null = null
    device: GPUDevice|null = null
    kernels: CompiledKernel[] = []
    private materialzedTrees: MaterializedTree[] = []

    constructor(){}

    async init(){
        await this.createDevice()
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

    createTask(params:TaskParams): CompiledTask {
        let task = new CompiledTask(this.device!,params)
        return task
    }

    createKernel(tasksParams:TaskParams[]): CompiledKernel {
        let kernel = new CompiledKernel(this.device!)
        for(let params of tasksParams){
            let task = this.createTask(params)
            kernel.tasks.push(task)
        }
        return kernel
    }

    async sync(){
        await this.device!.queue.onSubmittedWorkDone()
    }

    launchKernel(kernel: CompiledKernel){
        let commandEncoder = this.device!.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        for(let task of kernel.tasks){
            if(task.bindGroup === null){
                task.bindGroup = this.device!.createBindGroup({
                    layout: task.pipeline!.getBindGroupLayout(0),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: this.materialzedTrees[0].rootBuffer!,
                            },
                        },
                    ],
                })
            }
            passEncoder.setPipeline(task.pipeline!);
            passEncoder.setBindGroup(0, task.bindGroup);
            let numWorkGroups = divUp(task.params.invocatoions , 128);
            passEncoder.dispatch(numWorkGroups);
        }
        passEncoder.endPass();
        this.device!.queue.submit([commandEncoder.finish()]);
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
        this.materialzedTrees.push(materialized)
    }

    async copyRootBufferToHost(treeId: number): Promise<Int32Array> {
        let size = this.materialzedTrees[treeId].tree!.size
        const rootBufferCopy = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.materialzedTrees[treeId].rootBuffer!,0,rootBufferCopy,0,size)
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.device!.queue.onSubmittedWorkDone()
    
        await rootBufferCopy.mapAsync(GPUMapMode.READ)
        let result = new Int32Array(rootBufferCopy.getMappedRange())
        let copied = result.slice()
        rootBufferCopy.unmap()
        rootBufferCopy.destroy()
        return copied
    }

    async getRootBufferRenderer(canvas:HTMLCanvasElement):Promise<RootBufferRenderer> {
        let renderer = new RootBufferRenderer(this.adapter!,this.device!,this.materialzedTrees[0].rootBuffer!)
        await renderer.initForCanvas(canvas)
        return renderer
    }
}

export {Runtime}