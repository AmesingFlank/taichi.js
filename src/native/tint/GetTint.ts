// @ts-ignore
import {createTintModule} from './tint';

let nativeTintInstance:any = undefined

async function createNativeTint() {
    if(nativeTintInstance !== undefined){
        return nativeTintInstance
    }
    nativeTintInstance  = await createTintModule()
    return nativeTintInstance
}

let nativeTintProxy = {
    get: function(unused:any, prop:string) {
        return nativeTintInstance[prop]
    }
}

let nativeTint = new Proxy({},nativeTintProxy)


export {nativeTint, createNativeTint}