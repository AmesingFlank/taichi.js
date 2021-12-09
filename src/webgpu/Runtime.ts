import '@webgpu/types'

import { CompiledTask, CompiledKernel, TaskParams } from './Kernel'
import { SNodeTree } from '../program/SNodeTree'

class MaterializedTree {
    tree?: SNodeTree
    rootBuffer?: GPUBuffer
    device?: GPUDevice
}

class Runtime {
    device: GPUDevice|null = null
    kernels: CompiledKernel[] = []
    private materialzedTrees: MaterializedTree[] = []

    constructor(){
        this.createDevice()
    }

    async createDevice() {
        if (navigator.gpu === undefined){
            alert("Webgpu not supported")
        }
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter!.requestDevice();
        this.device = device
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
            passEncoder.dispatch(task.params.invocatoions / 128);
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
}

export {Runtime}