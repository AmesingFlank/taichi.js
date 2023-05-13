export class PipelineCache {
    constructor(public device: GPUDevice) {}
    private shaderModuleCache: Map<string, GPUShaderModule> = new Map<string, GPUShaderModule>()
    getOrCreateShaderModule(code: string): GPUShaderModule {
        if (!this.shaderModuleCache.has(code)) {
            let module = this.device!.createShaderModule({
                code: code,
            })
            this.shaderModuleCache.set(code, module)
            // console.log("new module", code)
        } else {
            // console.log("found existing module")
        }
        return this.shaderModuleCache.get(code)!
    }

    private equals(v1: any, v2: any) {
        if (typeof v1 !== typeof v2) {
            return false
        }
        if (Array.isArray(v1) && Array.isArray(v2)) {
            if (v1.length !== v2.length) {
                return false
            }
            for (let i = 0; i < v1.length; ++i) {
                if (!this.equals(v1[i], v2[i])) {
                    return false
                }
            }
        } else if (typeof v1 !== 'object') {
            if (v1 !== v2) {
                return false
            }
        } else if (v1 instanceof GPUShaderModule && v2 instanceof GPUShaderModule) {
            if (v1 !== v2) {
                return false
            }
        } else {
            // v1 v2 both "object"
            for (let k in v1) {
                if (!(k in v2)) {
                    return false
                }
            }
            for (let k in v2) {
                if (!(k in v1)) {
                    return false
                }
            }
            for (let k in v1) {
                if (!this.equals(v1[k], v2[k])) {
                    //console.log(k, typeof (v1[k]), v1[k] instanceof GPUShaderModule, v1[k], v2[k])
                    return false
                }
            }
        }
        return true
    }

    private computePipelineCache: [GPUComputePipelineDescriptor, GPUComputePipeline][] = []

    getOrCreateComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline {
        for (let pair of this.computePipelineCache) {
            if (this.equals(pair[0], desc)) {
                //console.log("found existing compute pipeline", pair[0], desc)
                return pair[1]
            }
        }
        let pipeline = this.device.createComputePipeline(desc)
        this.computePipelineCache.push([desc, pipeline])
        return pipeline
    }

    private RenderPipelineCache: [GPURenderPipelineDescriptor, GPURenderPipeline][] = []

    getOrCreateRenderPipeline(desc: GPURenderPipelineDescriptor): GPURenderPipeline {
        for (let pair of this.RenderPipelineCache) {
            if (this.equals(pair[0], desc)) {
                //console.log("found existing render pipeline")
                return pair[1]
            }
        }
        //console.log(desc)
        let pipeline = this.device.createRenderPipeline(desc)
        this.RenderPipelineCache.push([desc, pipeline])
        return pipeline
    }
}
