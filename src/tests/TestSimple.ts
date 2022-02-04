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

async function testSimple(): Promise<boolean> {
    log("testSimple")
     
    await init()
 
    let program = Program.getCurrentProgram()
    await program.materializeRuntime()
 
    let f = field([10], PrimitiveType.i32)
    addToKernelScope({f})
    program.materializeCurrentTree()

    let compiler = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let kernelCode = compiler.compileKernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                f[i] = i + i
            }
            //@ts-ignore
            for(let i of range(10)){
                f[i] = f[i] + i
            }
            //@ts-ignore
            for(let i of range(10)){
                f[i+1-1] = f[i-1+1] / 3
            }
            
        }
    )

    let kernel = program.runtime!.createKernel(kernelCode)
    
    program.runtime!.launchKernel(kernel)
    
    let fHost = await program.runtime!.copyFieldToHost(f)
    log(fHost)
    return assertArrayEqual(fHost,[0,1,2,3,4,5,6,7,8,9])
    
}

export {testSimple}