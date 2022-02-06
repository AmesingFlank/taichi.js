//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testMatrix(): Promise<boolean> {
    console.log("testMatrix")
     
    await ti.init() 

    let f = ti.Matrix.field(2,2, ti.i32, [2,2])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let i of range(2)){
                for(let j of range(2)){
                    f[i,j][0,0] = i * 1000 + j * 100
                    f[i,j][0,1] = i * 1000 + j * 100 + 1
                    f[i,j][1,0] = i * 1000 + j * 100 + 10
                    f[i,j][1,1] = i * 1000 + j * 100 + 11
                }
            }            
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    return assertArrayEqual(fHost,[0, 1, 10, 11, 100, 101, 110, 111, 1000, 1001, 1010, 1011, 1100, 1101, 1110, 1111])
}

export {testMatrix}