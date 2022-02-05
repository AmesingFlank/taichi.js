
enum BufferType {
    Root, GlobalTmps
}

class BufferBinding{
    constructor(
        public bufferType:BufferType,
        public rootID: number | null,
        public binding: number
    ){}

    equals(that:BufferBinding):boolean {
        return this.bufferType === that.bufferType && this.rootID === that.rootID && this.binding === that.binding
    }
}

class TaskParams {
    code:string = ""
    rangeHint: string = ""
    workgroupSize: number = 0
    bindings: BufferBinding[] = []
}

class CompiledTask {
    device: GPUDevice
    params: TaskParams
    pipeline: GPUComputePipeline|null = null
    bindGroup:GPUBindGroup | null = null
    constructor(device: GPUDevice, params:TaskParams){
        this.device = device
        this.params = params
        this.createPipeline()
    }
    createPipeline(){
        let code = this.params.code
        this.pipeline = this.device.createComputePipeline({
            compute: {
                module: this.device.createShaderModule({
                  code: code,
                }),
                entryPoint: 'main',
            },
        })
    }
}

class CompiledKernel {
    tasks: CompiledTask[] = []
    device: GPUDevice
    constructor(device: GPUDevice){
        this.device = device
    }
}

export {CompiledTask, CompiledKernel, TaskParams, BufferType, BufferBinding}