//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testArgs(): Promise<boolean> {
    console.log("testArgs")
     
    await ti.init() 

    let f = ti.field(ti.i32, [10])
    ti.addToKernelScope({f})

    let kernel = ti.kernel(
        (x) => {
            //@ts-ignore
            for(let i of range(10)){
                f[i] = i + x
            }
        }
    )

    kernel(3)
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[3,4,5,6,7,8,9,10,11,12])
}

export {testArgs}