import { BufferBinding, BufferType } from "../backend/Kernel";

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
        let bindingInfoPrefix = "[[group(0), binding("

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
            // for root buffers, root id === buffer id
            addBinding(new BufferBinding(BufferType.Root,bindingPoint,bindingPoint))
            continue
        }

        let globalTmpsPrefix = "global_tmps_"
        let globalTmpsBegin = stmt.indexOf(globalTmpsPrefix)
        if(globalTmpsBegin !== -1){
            addBinding(new BufferBinding(BufferType.GlobalTmps,null,bindingPoint))
            continue
        }

        let contextPrefix = "context_buffer_struct_array"
        let contexBegin = stmt.indexOf(contextPrefix)
        if(contexBegin !== -1){
            addBinding(new BufferBinding(BufferType.Context,null,bindingPoint))
            continue
        }
    }
    return bindings
}


export { getWgslShaderBindings}