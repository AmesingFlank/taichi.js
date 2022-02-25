//@ts-nocheck
import {assertArrayEqual} from "./Utils"

async function testAtomic(): Promise<boolean> {
    console.log("testAtomic")
     
    await ti.init() 

    let n1 = 100
    let n2 = 100
    let n3 = 100000

    let f1 = ti.field(ti.f32, [1])
    let f2 = ti.field(ti.f32, [1])
    let f3 = ti.field(ti.f32, [1])

    let i1 = ti.field(ti.i32, [1])
    let i2 = ti.field(ti.i32, [n2])
    let i3 = ti.field(ti.i32, [1])

    ti.addToKernelScope({f1, f2, f3, i1, i2, i3, n1, n2, n3}) 

    let kernel = ti.kernel(
        () => {
            for(let i of range(n1)){
                f1[0] += i
                ti.atomic_add(i1[0], i)
            }
            for(let i of range(n2)){
                let my_index = (f2[0] += 1)
                i2[i] = my_index
            }
            for(let i of range(n3)){
                ti.atomic_add(f3[0], 1)
                i3[0] += 1
            }
        }
    )

    kernel()
    
    let f1Host = await f1.toArray1D()
    let f2Host = await f2.toArray1D()
    let f3Host = await f3.toArray1D()

    let i1Host = await i1.toArray1D()
    let i2Host = await i2.toArray1D()
    let i3Host = await i3.toArray1D()

    console.log(f1Host)
    console.log(f2Host)
    console.log(f3Host)
    console.log(i1Host)
    console.log(i2Host)
    console.log(i3Host)

    let passed = true;
    passed &&= assertArrayEqual(f1Host, [ n1 * (n1-1) / 2 ])
    passed &&= assertArrayEqual(i1Host, [ n1 * (n1-1) / 2 ])
    passed &&= assertArrayEqual(f3Host, [n3])
    passed &&= assertArrayEqual(i3Host, [n3])
    passed &&= assertArrayEqual(f2Host, [n2])
    
    i2Host.sort(function(a, b){return a - b});
    for(let i = 0;i<n2; ++i){
        passed &&= assertArrayEqual([i2Host[i]], [i])
    }
    return passed
}

export {testAtomic}