//@ts-nocheck
import {assertEqual} from "./Utils"
import * as ti from "../taichi"

async function testRandom(): Promise<boolean> {
    console.log("testRandom")
     
    await ti.init() 

    let N = 10000

    let f = ti.field(ti.f32, [N])
    ti.addToKernelScope({f,N}) 

    let kernel = ti.kernel(
        () => {
            for(let i of range(N)){
                f[i] = random()
            }
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    let sum = 0
    let sum_sqr = 0
    for(let value of fHost){
        sum += value;
        sum_sqr += value * value
    }
    let mean = sum / N
    let mean_sqr = sum_sqr / N 
    console.log(mean, mean_sqr)
    console.log(fHost)
    // E[X] and E[X^2] where X~U(0,1)
    return assertEqual([mean],[0.5], 0.01) && assertEqual([mean_sqr],[1.0 / 3.0], 0.01)
}

export {testRandom}