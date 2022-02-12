//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testPropertyFunc(): Promise<boolean> {
    console.log("testPropertyFunc")
     
    await ti.init() 

    let f = ti.field(ti.f32, [12])
    ti.addToKernelScope({f}) 
    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            let x  = [3.0, 4.0]
            f[0] = x.norm()
            f[1] = x.norm_sqr()
            f[2] = x.length()
            f[3] = x.sum()

            f[4] = [3.0, 4.0].norm()
            f[5] = [3.0, 4.0].norm_sqr()
            f[6] = [3.0, 4.0].length()
            f[7] = [3.0, 4.0].sum()

            let y = [1.0, 2.0]
            f[8] = dot(x,y)
            f[9] = x.dot(y)

            f[10] = [3.0,4.0].normalized().x
            f[11] = [3.0,4.0].normalized().y
        }
    )

    kernel()
    
    let fHost = await f.toArray1D() 
    console.log(fHost)
    return assertArrayEqual(fHost,[5,25,2,7,5,25,2,7, 11,11, 0.6,0.8])  
}

export {testPropertyFunc}