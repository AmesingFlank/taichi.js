import { nativeTaichi, createNativeTaichi } from "../native/taichi/GetTaichi";
import { nativeTint, createNativeTint}  from "../native/tint/GetTint";
import {Program} from '../program/Program'

let initialized = false

async function init() {
    if(!initialized){
        await createNativeTaichi()
        await createNativeTint()
        await Program.getCurrentProgram().materializeRuntime()
        initialized = true
    }
}

export {init}