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
    await program.materializeRuntime()

    let f = field([10])
    //f.addToAotBuilder(program.nativeAotBuilder,"f") // This is crashing for somne readon. but i guess this isn't really needed..

    program.materializeCurrentTree()

    
    console.log(program.nativeProgram)
    
    let n = 10
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

      let ptr = ir_builder.create_global_ptr(f.placeNode, stmt_vec);
      console.log(ptr)

      ir_builder.create_global_ptr_global_store(ptr, index);

      loop_guard.delete()
    }
    
    let kernel_init = nativeTaichi.Kernel.create_kernel(program.nativeProgram,ir_builder , "init", false)
    console.log(kernel_init)

    program.nativeAotBuilder.add("init", kernel_init);

    let spv_codes = nativeTaichi.get_kernel_params(program.nativeAotBuilder,"init");
    let first_task_code = spv_codes.get(0).get_spirv_ptr()
    let num_words = first_task_code.size()
    let spv = []
    for(let i = 0; i < num_words; i += 1){
      spv.push(first_task_code.get(i))
    }
    console.log(spv)

    let code = nativeTint.tintSpvToWgsl(spv)
    console.log(code)

    let initKernel = program.runtime!.createKernel([
        {
            code:code,
            invocations: 10
        },
    ])
    
    program.runtime!.launchKernel(initKernel)
    
    let rootBufferCopy = await program.runtime!.copyRootBufferToHost(0)
    console.log("Example 4 results:")
    console.log(rootBufferCopy)
}

export {taichiExample4}