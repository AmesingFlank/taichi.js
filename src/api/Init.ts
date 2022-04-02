import { nativeTaichi, createNativeTaichi } from "../native/taichi/GetTaichi";
import {Program} from '../program/Program'

let initialized = false

async function init() {
    if(!initialized){
        await createNativeTaichi()
        await Program.getCurrentProgram().materializeRuntime()
        initialized = true
    }
    Program.getCurrentProgram().clearKernelScope()
}

export {init}