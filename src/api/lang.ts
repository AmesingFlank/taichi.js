import { OneTimeCompiler } from '../frontend/Compiler'
import {Program} from '../program/Program'
import {PrimitiveType} from "../frontend/Type"

function addToKernelScope(obj: any){
    let program = Program.getCurrentProgram()
    program.addToKernelScope(obj)
}

function kernel(f:any) : ((...args: any[]) => void) {
    let program = Program.getCurrentProgram()
    program.materializeCurrentTree()
    let compiler = new OneTimeCompiler(program.globalScopeObj)
    let kernelCode = compiler.compileKernel(f)
    let kernel = program.runtime!.createKernel(kernelCode)
    let result = (...args: any[]) => {
        program.runtime!.launchKernel(kernel,...args)
    }
    return result
}

async function sync() {
    await Program.getCurrentProgram().runtime!.sync()
}

const i32 = PrimitiveType.i32
const f32 = PrimitiveType.f32

export {addToKernelScope, kernel, i32, f32, sync}