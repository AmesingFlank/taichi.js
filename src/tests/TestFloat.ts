//@ts-nocheck
import * as ti from "../taichi"
import {assertEqual} from "./Utils"

async function testFloat(): Promise<boolean> {
    console.log("testFloat")
     
    await ti.init() 

    let f = ti.Vector.field(2, ti.f32, [3,3])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(3)){
                for(let j of range(3)){
                    let v = [i * 10 + j, i * 10 + j] + [0, 10000]
                    v = v * 2
                    f[[i,j]] = v / 2
                }
            }            
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertEqual(fHost,[0, 10000, 1, 10001, 2, 10002, 10, 10010, 11, 10011, 12, 10012, 20, 10020, 21, 10021, 22, 10022])
}

export {testFloat}