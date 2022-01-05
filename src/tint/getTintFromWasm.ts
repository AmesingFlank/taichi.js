
import {tintWasmBase64} from './tintWasmBase64'

let tintModule : WebAssembly.WebAssemblyInstantiatedSource | undefined = undefined

 
function decode(encoded:string) {
    var binaryString =  atob(encoded);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getTint() : Promise<WebAssembly.WebAssemblyInstantiatedSource>{
    if (tintModule !== undefined){
        return tintModule!
    }
 
    let buffer = decode(tintWasmBase64); 
    console.log(buffer)
    tintModule = await WebAssembly.instantiate(buffer, {});
    return tintModule
}

export {getTint}

