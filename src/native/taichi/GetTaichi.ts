// @ts-ignore
import {createTaichiModule} from './taichi'


type NativeTaichiAny = any

let taichiModule:NativeTaichiAny = undefined

async function getTaichiModule() {
    if(taichiModule !== undefined){
        return taichiModule
    }
    taichiModule = await createTaichiModule()
    return taichiModule
}

export {getTaichiModule, NativeTaichiAny}