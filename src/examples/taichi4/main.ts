import {nativeTint} from '../../native/tint/GetTint' 
 import {nativeTaichi, NativeTaichiAny} from '../../native/taichi/GetTaichi' 
import {Program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../program/FieldsFactory'
import {init} from '../../api/Init'

let taichiExample4 = async () => {
    await init()

    //@ts-ignore
    window.taichi = taichi

    let program = Program.getCurrentProgram()

    
    console.log(program.nativeProgram)
    
    let n = 10

    // program.materialize_runtime();
    let root : NativeTaichiAny = new nativeTaichi.SNode(0, nativeTaichi.SNodeType.root);
    console.log(root)

    let dense = root.dense(new nativeTaichi.Axis(0), n, false);
    console.log(dense)
    
    let place = dense.insert_children(nativeTaichi.SNodeType.place);
    console.log(place)

    place.dt_set(nativeTaichi.PrimitiveType.i32)


    program.nativeProgram.add_snode_tree(root,true)

    let aot_builder = program.nativeProgram.make_aot_module_builder(nativeTaichi.Arch.vulkan);
    console.log(aot_builder)

    let ir_builder : NativeTaichiAny = new nativeTaichi.IRBuilder()
    console.log(ir_builder)

    let zero = ir_builder.get_int32(0)
    console.log(zero)

    let n_stmt = ir_builder.get_int32(n)
    console.log(n_stmt)

    let loop = ir_builder.create_range_for(zero, n_stmt,  0, 4, 0, false);
    console.log(loop)
    {
      let loop_guard = ir_builder.get_range_loop_guard(loop);
      console.log(loop_guard) 
      let index = ir_builder.get_loop_index(loop,0);
      console.log(index)

      let stmt_vec : NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
      console.log(stmt_vec)
      stmt_vec.push_back(index)

      let ptr = ir_builder.create_global_ptr(place, stmt_vec);
      console.log(ptr)

      ir_builder.create_global_ptr_global_store(ptr, index);

      loop_guard.delete()
    }
    
    let kernel_init = nativeTaichi.Kernel.create_kernel(program.nativeProgram,ir_builder , "init", false)
    console.log(kernel_init)

    let n_singleton : NativeTaichiAny = new nativeTaichi.VectorOfInt()
    n_singleton.push_back(n);
    console.log("adding place")
    aot_builder.add_field("place", place, true, place.dt_get(), n_singleton, 1, 1);
    console.log("added place")
    aot_builder.add("init", kernel_init);
    console.log("added init")
    let spv_codes = nativeTaichi.get_kernel_spirv(aot_builder,"init");
    let first_task_code = spv_codes.get(0)
    let num_words = first_task_code.size()
    let spv = []
    for(let i = 0; i < num_words; i += 1){
      spv.push(first_task_code.get(i))
    }
    console.log(spv)
    
    await program.materializeRuntime()

    let f = field([10])

    program.materializeCurrentTree()

    let code = nativeTint.tintSpvToWgsl(spv)
    console.log(code)

    let initKernel = program.runtime!.createKernel([
        {
            code:code,
            invocatoions: 10
        },
    ])
    
    program.runtime!.launchKernel(initKernel)
    
    let rootBufferCopy = await program.runtime!.copyRootBufferToHost(0)
    console.log("Example 4 results:")
    console.log(rootBufferCopy)
}

export {taichiExample4}