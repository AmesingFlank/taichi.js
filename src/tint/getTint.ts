// @ts-ignore
import {createTintModule} from './tint';

let tintModule:any = undefined

async function getTintModule() {
    if(tintModule !== undefined){
        return tintModule
    }
    tintModule = await createTintModule()
    return tintModule
}

export {getTintModule}