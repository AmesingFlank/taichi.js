import { BufferBinding, BufferType } from "../backend/Kernel";
import { error } from "../utils/Logging";

// hacky af
function getWgslShaderBindings(wgsl:string):BufferBinding[] {
    let bindings:BufferBinding[] = []
    let addBinding = (binding:BufferBinding) => {
        for(let existing of bindings){
            if(existing.equals(binding)){
                return
            }
        }
        bindings.push(binding)
    }
    let stmts = wgsl.split(";")
    for(let stmt of stmts){
        let bindingInfoPrefix = "@group(0) @binding("

        let bindingInfoBegin = stmt.indexOf(bindingInfoPrefix)
        if(bindingInfoBegin === -1){
            continue
        }

        let bindingPointBegin = bindingInfoBegin + bindingInfoPrefix.length
        let closingParanthesis = stmt.indexOf(")",bindingPointBegin)
        let bindingPointStr = stmt.slice(bindingPointBegin,closingParanthesis)
        let bindingPoint = Number(bindingPointStr)

        let rootBufferPrefix = "root_buffer_"
        let rootBufferBegin = stmt.indexOf(rootBufferPrefix)
        if(rootBufferBegin !== -1){
            let rootIndexBegin = rootBufferBegin + rootBufferPrefix.length
            let rootIndexEnd = stmt.indexOf("_",rootIndexBegin)
            let rootIndex = Number(stmt.slice(rootIndexBegin,rootIndexEnd))
            if(stmt.indexOf("atomic") === -1){
                addBinding(new BufferBinding(BufferType.Root,rootIndex,bindingPoint))
            }
            else{
                addBinding(new BufferBinding(BufferType.RootAtomic,rootIndex,bindingPoint))
            }
            continue
        }

        let globalTmpsPrefix = "global_tmps_"
        let globalTmpsBegin = stmt.indexOf(globalTmpsPrefix)
        if(globalTmpsBegin !== -1){
            addBinding(new BufferBinding(BufferType.GlobalTmps,null,bindingPoint))
            continue
        }

        let argsPrefix = "args_"
        let argsBegin = stmt.indexOf(argsPrefix)
        if(argsBegin !== -1){
            addBinding(new BufferBinding(BufferType.Args,null,bindingPoint))
            continue
        }

        let retsPrefix = "rets_"
        let retsBegin = stmt.indexOf(retsPrefix)
        if(retsBegin !== -1){
            addBinding(new BufferBinding(BufferType.Rets,null,bindingPoint))
            continue
        }

        let randStatesPrefix = "rand_states_"
        let randStatesBegin = stmt.indexOf(randStatesPrefix)
        if(randStatesBegin !== -1){
            addBinding(new BufferBinding(BufferType.RandStates,null,bindingPoint))
            continue
        }
    }
    return bindings
}


enum WgslShaderStage {
    Compute, Vertex, Fragment
}

function getWgslShaderStage(wgsl:string) : WgslShaderStage {
    if(wgsl.indexOf("@stage(compute)") !== -1){
        return WgslShaderStage.Compute
    }
    if(wgsl.indexOf("@stage(vertex)") !== -1){
        return WgslShaderStage.Vertex
    }
    if(wgsl.indexOf("@stage(fragment)") !== -1){
        return WgslShaderStage.Fragment
    }
    error("could not infer stage of wgsl shader: ", wgsl);
    return  WgslShaderStage.Compute
}

export { getWgslShaderBindings, WgslShaderStage, getWgslShaderStage}