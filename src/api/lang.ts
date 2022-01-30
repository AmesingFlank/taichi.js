import {Program} from '../program/Program'

function addToKernelScope(obj: any){
    Program.getCurrentProgram().addToKernelScope(obj)
}

export {addToKernelScope}