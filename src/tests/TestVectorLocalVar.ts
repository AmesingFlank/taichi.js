//@ts-nocheck
import {ti} from "../taichi"
import {assertEqual} from "./Utils"

async function testVectorLocalVar(): Promise<boolean> {
    console.log("testVectorLocalVar")
     
    await ti.init() 

    let f = ti.Vector.field(2, ti.i32, [3,3])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(3)){
                for(let j of range(3)){
                    let v = [i * 10 + j, i * 10 + j + 10000]
                    f[[i,j]] = v
                }
            }            
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[0, 10000, 1, 10001, 2, 10002, 10, 10010, 11, 10011, 12, 10012, 20, 10020, 21, 10021, 22, 10022])
}

export {testVectorLocalVar}