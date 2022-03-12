//@ts-nocheck
import {ti} from "../taichi"
import {assertEqual} from "./Utils"

async function testIf(): Promise<boolean> {
    console.log("testIf")
     
    await ti.init() 

    let f = ti.field(ti.i32, [10])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(10)){
                if(i < 3 || i >= 8){
                    f[i] = i
                }
                else {
                    f[i] = 0
                }
            } 
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[0,1,2,0,0,0,0,0,8,9])
}

export {testIf}