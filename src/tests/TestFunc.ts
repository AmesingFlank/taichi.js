//@ts-nocheck
import * as ti from "../taichi"
import { assertEqual } from "./Utils"

async function testFunc(): Promise<boolean> {
    console.log("testFunc")

    await ti.init()

    let f1 = ti.field(ti.i32, [10])
    let f2 = ti.Vector.field(2, ti.i32, [10])
    let f3 = ti.Vector.field(2, ti.i32, [10])
    let f4 = ti.Vector.field(2, ti.i32, [10])
    let f5 = ti.Vector.field(2, ti.i32, [10])

    let returnOne = () => { return 1 }
    let identity = (x) => { return x }
    let plusOne = (x) => { return returnOne() + identity(x) }

    let getMirrorVec = (x) => [x, -x]
    // some compiler optimizes this to `(x,y) => {}` .... 
    // need to figure out how to address the inconsistency between taichi semantics and JS semantics.
    let modify =   `(x, i) => { x = x + i }` 
    let modifyUseless = (i, useless) => {
        useless = i;
        return useless
    }

    ti.addToKernelScope({ f1, f2, f3, f4, f5, returnOne, identity, plusOne, getMirrorVec, modify, modifyUseless })

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            for (let i of range(10)) {
                f1[i] = plusOne(i)
                f2[i] = plusOne([i, i])
                f3[i] = getMirrorVec(i)
                modify(f4[i], [i, i])
                f5[i] = modifyUseless(i, 123)
            }
        }
    )

    kernel()

    let f1Host = await f1.toArray1D()
    let f2Host = await f2.toArray1D()
    let f3Host = await f3.toArray1D()
    let f4Host = await f4.toArray1D()
    console.log(f1Host, f2Host, f3Host, f4Host)
    return assertEqual(f1Host, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        && assertEqual(f2Host, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10])
        && assertEqual(f3Host, [0, 0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9])
        && assertEqual(f4Host, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9])
}

export { testFunc }