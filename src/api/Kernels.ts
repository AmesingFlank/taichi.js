import { KernelCompiler } from '../language/frontend/Compiler';
import { Program } from '../program/Program';
import { PrimitiveType, ScalarType, Type } from '../language/frontend/Type';
import { assert, error } from '../utils/Logging';
import { CompiledKernel } from '../runtime/Kernel';
import { ParsedFunction } from '../language/frontend/ParsedFunction';
import { KernelFactory, Template } from '../language/frontend/KernelFactory';

export function addToKernelScope(obj: any) {
    let program = Program.getCurrentProgram();
    program.addToKernelScope(obj);
}

export function clearKernelScope() {
    let program = Program.getCurrentProgram();
    program.clearKernelScope();
}

export function template() {
    return new Template();
}

export type KernelType = (...args: any[]) => any;
export type FuncType = (...args: any[]) => any;

export function kernel(argTypesOrCode: any, codeOrUndefined?: any): KernelType {
    let argsMapObj: any = {};
    let code: any;
    if (typeof argTypesOrCode === 'function' || typeof argTypesOrCode === 'string') {
        code = argTypesOrCode;
    } else {
        code = codeOrUndefined;
        argsMapObj = argTypesOrCode;
    }
    return KernelFactory.kernel(Program.getCurrentProgram().kernelScope.clone(), argsMapObj, code);
}

export function classKernel(thisObj: any, argTypesOrCode: any, codeOrUndefined?: any): KernelType {
    let argsMapObj: any = {};
    let code: any;
    if (typeof argTypesOrCode === 'function' || typeof argTypesOrCode === 'string') {
        code = argTypesOrCode;
    } else {
        code = codeOrUndefined;
        argsMapObj = argTypesOrCode;
    }
    let scope = Program.getCurrentProgram().kernelScope.clone();
    scope.thisObj = thisObj;
    return KernelFactory.kernel(scope, argsMapObj, code);
}

export function func(f: any): FuncType {
    return f;
}

export async function sync() {
    await Program.getCurrentProgram().runtime!.sync();
}

export const i32 = PrimitiveType.i32;
export const f32 = PrimitiveType.f32;
