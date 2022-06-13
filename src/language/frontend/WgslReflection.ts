import { ResourceBinding, ResourceInfo, ResourceType } from "../../runtime/Kernel";
import { error } from "../../utils/Logging";

// hacky af
function getWgslShaderBindings(wgsl: string): ResourceBinding[] {
    let bindings: ResourceBinding[] = []
    let addBinding = (binding: ResourceBinding) => {
        for (let existing of bindings) {
            if (existing.equals(binding)) {
                return
            }
        }
        bindings.push(binding)
    }
    let stmts = wgsl.split(";")
    for (let stmt of stmts) {
        let bindingInfoPrefix = "@group(0) @binding("

        let bindingInfoBegin = stmt.indexOf(bindingInfoPrefix)
        if (bindingInfoBegin === -1) {
            continue
        }

        let bindingPointBegin = bindingInfoBegin + bindingInfoPrefix.length
        let closingParanthesis = stmt.indexOf(")", bindingPointBegin)
        let bindingPointStr = stmt.slice(bindingPointBegin, closingParanthesis)
        let bindingPoint = Number(bindingPointStr)

        let rootBufferPrefix = "root_buffer_"
        let rootBufferBegin = stmt.indexOf(rootBufferPrefix)
        if (rootBufferBegin !== -1) {
            let rootIndexBegin = rootBufferBegin + rootBufferPrefix.length
            let rootIndexEnd = stmt.indexOf("_", rootIndexBegin)
            let rootIndex = Number(stmt.slice(rootIndexBegin, rootIndexEnd))
            if (stmt.indexOf("atomic") === -1) {
                addBinding(new ResourceBinding(new ResourceInfo(ResourceType.Root, rootIndex), bindingPoint))
            }
            else {
                addBinding(new ResourceBinding(new ResourceInfo(ResourceType.RootAtomic, rootIndex), bindingPoint))
            }
            continue
        }

        let globalTmpsPrefix = "global_tmps_"
        let globalTmpsBegin = stmt.indexOf(globalTmpsPrefix)
        if (globalTmpsBegin !== -1) {
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.GlobalTmps, undefined), bindingPoint))
            continue
        }

        let argsPrefix = "args_"
        let argsBegin = stmt.indexOf(argsPrefix)
        if (argsBegin !== -1) {
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.Args, undefined), bindingPoint))
            continue
        }

        let retsPrefix = "rets_"
        let retsBegin = stmt.indexOf(retsPrefix)
        if (retsBegin !== -1) {
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.Rets, undefined), bindingPoint))
            continue
        }

        let randStatesPrefix = "rand_states_"
        let randStatesBegin = stmt.indexOf(randStatesPrefix)
        if (randStatesBegin !== -1) {
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.RandStates, undefined), bindingPoint))
            continue
        }

        let texturePrefix = "texture_"
        let textureBegin = stmt.indexOf(texturePrefix)
        if (textureBegin !== -1) {
            let textureIndexBegin = textureBegin + texturePrefix.length
            let textureIndexEnd = stmt.indexOf("_", textureIndexBegin)
            let textureIndex = Number(stmt.slice(textureIndexBegin, textureIndexEnd))
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.Texture, textureIndex), bindingPoint))
        }

        let samplerPrefix = "sampler_"
        let samplerBegin = stmt.indexOf(samplerPrefix)
        if (samplerBegin !== -1) {
            let samplerIndexBegin = samplerBegin + samplerPrefix.length
            let samplerIndexEnd = stmt.indexOf("_", samplerIndexBegin)
            let samplerIndex = Number(stmt.slice(samplerIndexBegin, samplerIndexEnd))
            addBinding(new ResourceBinding(new ResourceInfo(ResourceType.Sampler, samplerIndex), bindingPoint))
        }
    }
    return bindings
}


enum WgslShaderStage {
    Compute, Vertex, Fragment
}

function getWgslShaderStage(wgsl: string): WgslShaderStage {
    if (wgsl.indexOf("@stage(compute)") !== -1) {
        return WgslShaderStage.Compute
    }
    if (wgsl.indexOf("@stage(vertex)") !== -1) {
        return WgslShaderStage.Vertex
    }
    if (wgsl.indexOf("@stage(fragment)") !== -1) {
        return WgslShaderStage.Fragment
    }
    error("could not infer stage of wgsl shader: ", wgsl);
    return WgslShaderStage.Compute
}

export { getWgslShaderBindings, WgslShaderStage, getWgslShaderStage }