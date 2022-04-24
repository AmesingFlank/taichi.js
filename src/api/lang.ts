import { KernelCompiler } from '../frontend/Compiler'
import { Program } from '../program/Program'
import { PrimitiveType, ScalarType, Type } from "../frontend/Type"
import { assert, error } from '../utils/Logging'
import { CompiledKernel } from '../backend/Kernel'
import { ParsedFunction } from '../frontend/ParsedFunction'
import { KernelFactory, Template } from '../frontend/KernelFactory'

function addToKernelScope(obj: any) {
    let program = Program.getCurrentProgram()
    program.addToKernelScope(obj)
}

function clearKernelScope() {
    let program = Program.getCurrentProgram()
    program.clearKernelScope()
}



function template() {
    return new Template()
}


function kernel(argTypesOrCode: any, codeOrUndefined: any): ((...args: any[]) => void) {
    let argsMapObj: any = {}
    let code: any
    if (typeof argTypesOrCode === "function" || typeof argTypesOrCode === "string") {
        code = argTypesOrCode
    }
    else {
        code = codeOrUndefined
        argsMapObj = argTypesOrCode
    }
    return KernelFactory.kernel(Program.getCurrentProgram().kernelScope.clone(), argsMapObj, code)
}

function classKernel(thisObj: any, argTypesOrCode: any, codeOrUndefined: any): ((...args: any[]) => void) {
    let argsMapObj: any = {}
    let code: any
    if (typeof argTypesOrCode === "function" || typeof argTypesOrCode === "string") {
        code = argTypesOrCode
    }
    else {
        code = codeOrUndefined
        argsMapObj = argTypesOrCode
    }
    let scope = Program.getCurrentProgram().kernelScope.clone()
    scope.thisObj = thisObj
    return KernelFactory.kernel(scope, argsMapObj, code)
}

function func(f: any): ((...args: any[]) => any) {
    return f
}

async function sync() {
    await Program.getCurrentProgram().runtime!.sync()
}

const i32 = PrimitiveType.i32
const f32 = PrimitiveType.f32

export { addToKernelScope, clearKernelScope, kernel, classKernel, func, i32, f32, sync, template }