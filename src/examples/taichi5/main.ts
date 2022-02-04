// @ts-nocheck
import {nativeTint} from '../../native/tint/GetTint' 
import {nativeTaichi, NativeTaichiAny} from '../../native/taichi/GetTaichi' 
import {Program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../program/FieldsFactory'
import {init} from '../../api/Init'
import {OneTimeCompiler} from '../../frontend/Compiler'
import {addToKernelScope} from '../../api/Lang'
import {PrimitiveType} from "../../frontend/Type"

let taichiExample5 = async () => {
    await init()

    //@ts-ignore
    window.taichi = taichi

    let program = Program.getCurrentProgram()
    await program.materializeRuntime()
 
    let f = field([10], PrimitiveType.i32)
    addToKernelScope({f})
    program.materializeCurrentTree()

    let compiler = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let result = compiler.compileKernel(
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

    console.log("result length: ",result.length)

    let initKernel = program.runtime!.createKernel(result)
    
    program.runtime!.launchKernel(initKernel)
    
    let f1Host = await program.runtime!.copyFieldToHost(f)
    console.log("Example 5 results:")
    console.log(f1Host)

    let f2 = field([10], PrimitiveType.i32)
    addToKernelScope({f2})
    program.materializeCurrentTree()

    let compiler2 = new OneTimeCompiler(Program.getCurrentProgram().globalScopeObj)

    let result2 = compiler2.compileKernel(
        function k2() {
            //@ts-ignore
            for(let i of range(10)){
                f2[i] = i + i
            }
            //@ts-ignore
            for(let i of range(10)){
                f2[i] = f2[i] + i
            } 
            
        }
    )

    console.log("result length: ",result2.length)

    let initKernel2 = program.runtime!.createKernel(result2)
    
    program.runtime!.launchKernel(initKernel2)
    
    let f2Host = await program.runtime!.copyFieldToHost(f2)
    console.log("Example 5 results2:")
    console.log(f2Host)
    
}

export {taichiExample5}