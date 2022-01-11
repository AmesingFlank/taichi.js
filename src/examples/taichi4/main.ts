import {getTintModule} from '../../tint/getTint' 
import {getTaichiModule} from '../../taichi_emscriptened/getTaichi' 


let taichiExample4 = async () => {
    console.log("im here")
    let tint = await getTintModule()
    let taichi = await getTaichiModule()

    //@ts-ignore
    window.taichi = taichi
    
    let program = new taichi.Program(taichi.Arch.vulkan)
    console.log(program)
    
    let n = 10

    // program.materialize_runtime();
    let root = new taichi.SNode(0, taichi.SNodeType.root);
    console.log(root)

    let dense = root.dense(new taichi.Axis(0), n, false);
    console.log(dense)
    
    let place = dense.insert_children(taichi.SNodeType.place);
    console.log(place)

    
}

export {taichiExample4}