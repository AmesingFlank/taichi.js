//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testVector(): Promise<boolean> {
    console.log("testVector")
     
    await ti.init() 

    let f = ti.Vector.field(2, ti.i32, [3,3])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(3)){
                for(let j of range(3)){
                    f[i,j][0] = i * 10 + j
                    f[i,j][1] = i * 10 + j + 10000
                }
            }            
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[0, 10000, 1, 10001, 2, 10002, 10, 10010, 11, 10011, 12, 10012, 20, 10020, 21, 10021, 22, 10022])
}

export {testVector}