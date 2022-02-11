//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testPropertyFunc(): Promise<boolean> {
    console.log("testPropertyFunc")
     
    await ti.init() 

    let f = ti.field(ti.i32, [8])
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
        }
    )

    kernel()
    
    let fHost = await f.toArray1D() 
    console.log(fHost)
    return assertArrayEqual(fHost,[5,25,2,7,5,25,2,7])  
}

export {testPropertyFunc}