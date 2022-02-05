//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testSimple(): Promise<boolean> {
    console.log("testSimple")
     
    await ti.init() 

    let f = ti.field([10], ti.i32)
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                f[i] = i + i
            }
            //@ts-ignore
            for(let i of range(10)){
                f[i] = f[i] + i
            }
            //@ts-ignore
            for(let i of range(10)){
                f[i+1-1] = f[i-1+1] / 3
            }
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[0,1,2,3,4,5,6,7,8,9])
}

export {testSimple}