//@ts-nocheck
import {ti} from "../taichi"
import {assertEqual} from "./Utils"

async function testSerial(): Promise<boolean> {
    console.log("testSerial")
     
    await ti.init() 

    let f = ti.Vector.field(2, ti.f32, [1])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            let v = [1.5, 4.5]
            v = v * 2
            f[0] = v           
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[3, 9])
}

export {testSerial}