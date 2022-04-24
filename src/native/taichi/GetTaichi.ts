// @ts-ignore
import { createTaichiModule } from "./taichi"


type NativeTaichiAny = any

let nativeTaichiInstance: NativeTaichiAny = undefined

async function createNativeTaichi() {
    if(nativeTaichiInstance !== undefined){
        return nativeTaichiInstance
    }
    nativeTaichiInstance = await createTaichiModule()
    return nativeTaichiInstance
}

let nativeTaichiProxy = {
    get: function(unused: NativeTaichiAny, prop: string) {
        return  nativeTaichiInstance[prop]
    }
}

let nativeTaichi = new Proxy({},nativeTaichiProxy)

export { nativeTaichi, createNativeTaichi, NativeTaichiAny }