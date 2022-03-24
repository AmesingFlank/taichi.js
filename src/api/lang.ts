import { KernelCompiler, ParsedFunction } from '../frontend/Compiler'
import {Program} from '../program/Program'
import {PrimitiveType, ScalarType, Type} from "../frontend/Type" 
import { assert, error } from '../utils/Logging'
import { CompiledKernel } from '../backend/Kernel'

function addToKernelScope(obj: any){
    let program = Program.getCurrentProgram()
    program.addToKernelScope(obj)
}

// Similar to Python Taichi, Template is a dummy class whose sole purpose is for marking template arguments with ti.template()
class Template {

}

function template(){
    return new Template()
}

class TemplateKernel {

    instances: [Map<string,any>, CompiledKernel][] = []

    findInstance(templateArgs: Map<string,any>) : CompiledKernel | null {
        for(let instance of this.instances){
            let match = true
            let instanceArgs  = instance[0]
            for(let name of instanceArgs.keys()){
                if(!templateArgs.has(name) || templateArgs.get(name) !== instanceArgs.get(name)){
                    match = false
                }
            }
            if(match){
                return instance[1]
            }
        }
        return null
    }
}

let templateKernelCache : Map<string, TemplateKernel> = new Map<string, TemplateKernel>()

function kernel(argTypesOrCode:any, codeOrUndefined:any) : ((...args: any[]) => void) {
    let argsMapObj:any = {}
    let code:any
    if(typeof argTypesOrCode === "function" || typeof argTypesOrCode === "string"){
        code = argTypesOrCode
    }
    else{
        code = codeOrUndefined
        argsMapObj = argTypesOrCode
    }

    let argTypesMap = new Map<string, Type>()
    let templateArgNamesSet = new Set<string>()
    for(let k in argTypesMap){
        let type = argsMapObj[k]
        if(type === PrimitiveType.f32 || PrimitiveType.i32){
            type = new ScalarType(type)
            argTypesMap.set(k, type)
        }
        else if(type instanceof Type){
            argTypesMap.set(k, type)
        }
        else if(type instanceof Template){
            templateArgNamesSet.add(k)
        }
        else{
            error("Invalid argument type annotations")
        }
    }
    let codeString = code.toString()
    let program = Program.getCurrentProgram()
    let parsedFunction = new ParsedFunction(codeString)
    let argNames = parsedFunction.argNames
    if(!templateKernelCache.has(codeString)){
        templateKernelCache.set(codeString, new TemplateKernel())
    }
    let template = templateKernelCache.get(codeString)!

    if(templateArgNamesSet.size === 0){
        program.materializeCurrentTree()
        let compiler = new KernelCompiler()
        let kernelParams = compiler.compileKernel(parsedFunction,Program.getCurrentProgram().kernelScopeObj,argTypesMap)
        let kernel = program.runtime!.createKernel(kernelParams)
        let result = async (...args: any[]) => {
            return await program.runtime!.launchKernel(kernel,...args)
        }
        return result
    }
    else{
        let result = async (...args: any[]) => {
            assert(args.length === argNames.length,
                `Kernel requires ${argNames.length} arguments, but ${args.length} is provided`)
            let templateArgs = new Map<string, any>()
            for(let i = 0; i < args.length;++i){
                let name = argNames[i]
                if(templateArgNamesSet.has(name)){
                    let val = args[i]
                    templateArgs.set(name, val)
                }
            }
            let existingInstance = template.findInstance(templateArgs)
            if(existingInstance!==null){
                return await program.runtime!.launchKernel(existingInstance,...args)
            }
            let compiler = new KernelCompiler()
            let kernelParams = compiler.compileKernel(parsedFunction,Program.getCurrentProgram().kernelScopeObj,argTypesMap, templateArgs)
            let kernel = program.runtime!.createKernel(kernelParams)
            template.instances.push([templateArgs,kernel])
            return await program.runtime!.launchKernel(kernel,...args)
        }
        return result
    }
}

function func(f:any) : ((...args: any[]) => any) {
    return f
}

async function sync() {
    await Program.getCurrentProgram().runtime!.sync()
}

const i32 = PrimitiveType.i32
const f32 = PrimitiveType.f32

export {addToKernelScope, kernel, func, i32, f32, sync}