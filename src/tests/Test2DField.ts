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

async function test2DField(): Promise<boolean> {
    log("test2DField")
     
    await init()
 
    let program = Program.getCurrentProgram()
    await program.materializeRuntime()
 
    let f = field([3,3], PrimitiveType.i32)
    addToKernelScope({f})
    program.materializeCurrentTree()

    let compiler = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let kernelCode = compiler.compileKernel(
        function k() {
            //@ts-ignore
            for(let i of range(3)){
                for(let j of range(3)){
                    f[i,j] = i * 10 + j
                }
            }            
        }
    )

    let kernel = program.runtime!.createKernel(kernelCode)
    
    program.runtime!.launchKernel(kernel)
    
    let fHost = await program.runtime!.copyFieldToHost(f)
    log(fHost)
    return assertArrayEqual(fHost,[0,1,2,10,11,12,20,21,22])
    
}

export {test2DField}