//@ts-nocheck
import {ti} from "../taichi"
import {assertArrayEqual} from "./Utils"

async function testFunc(): Promise<boolean> {
    console.log("testFunc")
     
    await ti.init() 

    let f1 = ti.field(ti.i32, [10])
    let f2 = ti.Vector.field(2,ti.i32, [10])
    let f3 = ti.Vector.field(2,ti.i32, [10])

    let returnOne = () => {return 1}
    let identity = (x) => {return x}
    let plusOne = (x) => {return returnOne() + identity(x)}

    let getMirrorVec = (x) => [x, -x]

    ti.addToKernelScope({f1, f2, f3, returnOne, identity, plusOne, getMirrorVec})

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            for(let i of range(10)){
                f1[i] = plusOne(i)
                f2[i] = plusOne([i,i])
                f3[i] = getMirrorVec(i)
            }
        }
    )

    kernel()
    
    let f1Host = await f1.toArray1D()
    let f2Host = await f2.toArray1D()
    let f3Host = await f3.toArray1D()
    console.log(f1Host, f2Host, f3Host)
    return assertArrayEqual(f1Host,[1,2,3,4,5,6,7,8,9,10]) 
           && assertArrayEqual(f2Host,[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10])
           && assertArrayEqual(f3Host,[0,0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8,-8,9,-9])
}

export {testFunc}