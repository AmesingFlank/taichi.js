import {getTintModule} from '../../tint/getTint' 
import {getTaichiModule} from '../../taichi_emscriptened/getTaichi' 


let taichiExample4 = async () => {
    let tint = await getTintModule()
    let taichi = await getTaichiModule()

    //@ts-ignore
    window.taichi = taichi
    
    let program = new taichi.Program(taichi.Arch.vulkan)
    console.log(program)
}

export {taichiExample4}