//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testContinue(): Promise<boolean> {
    console.log("testContinue")
     
    await ti.init() 

    let f1 = ti.field(ti.i32, [10])
    let f2 = ti.field(ti.i32, [10])
    ti.addToKernelScope({f1, f2}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            let i = 0
            while(i < 10){
                if(i < 5){
                    i = i + 1
                    continue
                }
                f1[i] = i
                i = i + 1
            }
            for(let j of range(10)){
                if(j < 5){
                    continue
                }
                f2[j] = 2 * j
            }
        }
    )

    kernel()
    
    let f1Host = await f1.toArray1D()
    let f2Host = await f2.toArray1D()
    console.log(f1Host, f2Host)
    return assertArrayEqual(f1Host,[0,0,0,0,0,5,6,7,8,9]) && assertArrayEqual(f2Host,[0,0,0,0,0,10,12,14,16,18])
}

export {testContinue}