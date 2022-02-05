//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testMath(): Promise<boolean> {
    console.log("testMath")
     
    await ti.init() 

    let f = ti.field([3], ti.f32)
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            let x = max(0.5,0.75)
            f[0] = x    

            let c = sin(x)
            let s = cos(x)
            f[1] = c * c + s * s

            f[2] = log(4) / log(2)
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[0.75, 1, 2])
}

export {testMath}