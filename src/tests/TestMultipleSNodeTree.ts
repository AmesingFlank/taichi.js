//@ts-nocheck
import * as ti from "../taichi"
import {assertEqual} from "./Utils"
async function testMultipleSNodeTree(): Promise<boolean> {
    console.log("testMultipleSNodeTree")
     
    await ti.init() 

    let f1 = ti.field(ti.i32, [7])
    ti.addToKernelScope({f1}) 
    let k1 = ti.kernel(
        function k1() {
            //@ts-ignore
            for(let i of range(7)){
                f1[i] = i 
            }
        }
    )

    k1()

    let f2 = ti.field(ti.i32, [7])
    ti.addToKernelScope({f1, f2}) 

    let k2 = ti.kernel(
        function k2() {
            //@ts-ignore
            for(let i of range(7)){
                f2[i] = f1[i] + 1
            }
        }
    )

    k2()
    
    let f1Host = await f1.toArray1D()
    let f2Host = await f2.toArray1D()
     
    console.log(f1Host,f2Host)
    return assertEqual(f1Host,[0,1,2,3,4,5,6]) && assertEqual(f2Host,[1,2,3,4,5,6,7])
    
}

export {testMultipleSNodeTree}