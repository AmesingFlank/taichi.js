//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testLocalVar(): Promise<boolean> {
    console.log("testLocalVar")
     
    await ti.init() 

    let f = ti.field(ti.i32, [10])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                let j = i + i
                f[i] = j
            }
            //@ts-ignore
            for(let i of range(10)){
                let j = f[i]
                j = j + i
                f[i] = j
            }
            //@ts-ignore
            for(let i of range(10)){
                let j = i - 1 + 1
                j = i32(f[j] / 3)
                f[i+1-1] = j
            }
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[0,1,2,3,4,5,6,7,8,9])
    
}

export {testLocalVar}