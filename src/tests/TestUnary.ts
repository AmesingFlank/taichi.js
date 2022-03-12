//@ts-nocheck
import {ti} from "../taichi"
import {assertEqual} from "./Utils"

async function testUnary(): Promise<boolean> {
    console.log("testUnary")
     
    await ti.init() 

    let f = ti.field(ti.i32, [10])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                if(!(i>=5)){
                    f[i] = -i
                }
            }
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[0,-1,-2,-3,-4,0,0,0,0,0])
}

export {testUnary}