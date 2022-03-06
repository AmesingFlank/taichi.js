//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testSwizzle(): Promise<boolean> {
    console.log("testSwizzle")
     
    await ti.init() 

    let f = ti.field(ti.f32, [10])
    ti.addToKernelScope({f}) 
    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            let v0  = [0.0,1.0,2.0,3.0]
            let v1 = v0.xyzw
            f[0] = v1.x
            f[1] = v1.y
            f[2] = v1.z
            f[3] = v1.w

            let v2 = [0.0,1.0,2.0,3.0].bgra
            f[4] = v2.r
            f[5] = v2.g
            f[6] = v2.b
            f[7] = v2.a

            let v3 = [0.0,1.0].uv
            f[8] = v3.v
            f[9] = v3.u
        }
    )

    kernel()
    
    let fHost = await f.toArray1D() 
    console.log(fHost)
    return assertArrayEqual(fHost,[0,1,2,3,2,1,0,3,1,0])  
}

export {testSwizzle}