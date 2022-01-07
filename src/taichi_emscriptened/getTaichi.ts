// @ts-ignore
import {createTaichiModule} from './taichi'

let taichiModule:any = undefined

async function getTaichiModule() {
    if(taichiModule !== undefined){
        return taichiModule
    }
    taichiModule = await createTaichiModule()
    return taichiModule
}

export {getTaichiModule}