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

    place.dt = taichi.PrimitiveType.i32

    let aot_builder = program.make_aot_module_builder(taichi.Arch.vulkan);
    console.log(aot_builder)

    let ir_builder = new taichi.IRBuilder()
    console.log(ir_builder)

    let zero = ir_builder.get_int32(0)
    console.log(zero)

    let n_stmt = ir_builder.get_int32(n)
    console.log(n_stmt)

    let loop = ir_builder.create_range_for(zero, n_stmt, 1, 0, 4, 0, false);
    console.log(loop)
    {
      let loop_guard = ir_builder.get_range_loop_guard(loop);
      console.log(loop_guard)
      let index = ir_builder.get_loop_index(loop,0);
      console.log(index)
    //   auto *ptr = ir_builder.create_global_ptr(place, {index});
    //   ir_builder.create_global_store(ptr, index);
      loop_guard.delete()
    }
    
}

export {taichiExample4}