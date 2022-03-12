//@ts-nocheck
import {assertEqual} from "./Utils"

async function testStaticLoopUnroll(): Promise<boolean> {
    console.log("testStaticLoopUnroll")
     
    await ti.init() 

    let v = ti.Vector.field(3,ti.i32, [1])
    let m = ti.Matrix.field(3,3,ti.i32, [2] )
    ti.addToKernelScope({v, m}) 

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            for(let _ of range(1)){
                for(let i of ti.static(ti.range(3))){
                    v[0][i] = i
                }
                for(let i of ti.static(ti.range(3))){
                    for(let j of ti.static(ti.range(3))){
                        m[0][i,j] = i*10 + j
                    }
                }
                for(let I of ti.static(ti.ndrange(3,3))){
                    m[1][I[0],I[1]] = I[0]*10 + I[1]
                }
            }
        }
    )

    kernel()
    
    let vHost = await v.toArray1D()
    let mHost = await m.toArray1D()
    console.log(vHost, mHost)
    return assertEqual(vHost,[0,1,2]) && assertEqual(mHost,[0,1,2, 10,11,12,20,21,22,0,1,2, 10,11,12,20,21,22 ])
}

export {testStaticLoopUnroll}