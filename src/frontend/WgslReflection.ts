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
            let rootIndexBegin = rootBufferBegin + rootBufferPrefix.length
            let rootIndexEnd = stmt.indexOf("_",rootIndexBegin)
            let rootIndex = Number(stmt.slice(rootIndexBegin,rootIndexEnd))
            addBinding(new BufferBinding(BufferType.Root,rootIndex,bindingPoint))
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

        let randStatesPrefix = "rand_states_"
        let randStatesBegin = stmt.indexOf(randStatesPrefix)
        if(randStatesBegin !== -1){
            addBinding(new BufferBinding(BufferType.RandStates,null,bindingPoint))
            continue
        }
    }
    return bindings
}


export { getWgslShaderBindings}