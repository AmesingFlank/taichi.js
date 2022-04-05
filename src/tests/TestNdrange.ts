//@ts-nocheck
import {ti} from "../taichi"
import {assertEqual} from "./Utils"

async function testNdrange(): Promise<boolean> {
    console.log("testNdrange")
     
    await ti.init() 

    let f = ti.field(ti.i32, [3,3])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let I of ndrange(3,3)){
                let i = I[0]
                let j = I[1]
                f[[i,j]] = i * 10 + j
            }            
        }
    )

    kernel()

    let fHost = await f.toArray1D()
     
    console.log(fHost)
    return assertEqual(fHost,[0,1,2,10,11,12,20,21,22])
    
}

export {testNdrange}