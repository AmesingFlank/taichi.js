//@ts-nocheck
import {nativeTint} from '../native/tint/GetTint' 
import {nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import {Program} from '../program/Program'
import {field,Vector,Matrix}  from '../program/FieldsFactory'
import {init} from '../api/Init'
import {OneTimeCompiler} from '../frontend/Compiler'
import {addToKernelScope} from '../api/Lang'
import {PrimitiveType} from "../frontend/Type"
import {assertArrayEqual} from "./Utils"
import {log} from "../utils/Logging"

async function testCopyFieldToHost1D(): Promise<boolean> {
    log("testCopyFieldToHost1D")
     
    await init()

    let program = Program.getCurrentProgram()
    await program.materializeRuntime()
 
    let f1 = field([7], PrimitiveType.i32)
    let f2 = field([5], PrimitiveType.i32)
    addToKernelScope({f1, f2})
    program.materializeCurrentTree()

    let compiler = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let kernelCode = compiler.compileKernel(
        function k() {
            //@ts-ignore
            for(let i of range(7)){
                f1[i] = i 
            }
             //@ts-ignore
            for(let i of range(5)){
                f2[i] = i + i
            }
        }
    )

    let kernel = program.runtime!.createKernel(kernelCode)
    
    program.runtime!.launchKernel(kernel)
    
    let f1Host = await program.runtime!.copyFieldToHost(f1)
    let f2Host = await program.runtime!.copyFieldToHost(f2)
    log(f1Host,f2Host)
    return assertArrayEqual(f1Host,[0,1,2,3,4,5,6]) && assertArrayEqual(f2Host,[0,2,4,6,8])
    
}

export {testCopyFieldToHost1D}