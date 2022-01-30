import {nativeTint} from '../../native/tint/GetTint' 
import {nativeTaichi, NativeTaichiAny} from '../../native/taichi/GetTaichi' 
import {Program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../program/FieldsFactory'
import {init} from '../../api/Init'
import {OneTimeCompiler} from '../../frontend/Compiler'
import {addToKernelScope} from '../../api/Lang'

let taichiExample5 = async () => {
    await init()

    //@ts-ignore
    window.taichi = taichi

    let program = Program.getCurrentProgram()
    await program.materializeRuntime()
 
    let f = field([10])
    addToKernelScope({f})
    program.materializeCurrentTree()

    let compiler = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let result = compiler.compileKernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                f[i] = i
            }
        }
    )

    let initKernel = program.runtime!.createKernel(result)
    
    program.runtime!.launchKernel(initKernel)
    
    let rootBufferCopy = await program.runtime!.copyRootBufferToHost(0)
    console.log("Example 5 results:")
    console.log(rootBufferCopy)
    
}

export {taichiExample5}