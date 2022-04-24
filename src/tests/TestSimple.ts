//@ts-nocheck
import * as ti from "../taichi"
import {assertEqual} from "./Utils"

async function testSimple(): Promise<boolean> {
    console.log("testSimple")
     
    await ti.init() 

    let f = ti.field(ti.i32, [10])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() { 
            for(let i of range(10)){
                f[i] = i + i
            } 
            for(let i of range(10)){
                f[i] = f[i] + i
            } 
            for(let i of range(10)){
                f[i+1-1] = i32(f[i-1+1] / 3)
            }
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[0,1,2,3,4,5,6,7,8,9])
}

export {testSimple}