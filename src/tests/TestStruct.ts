//@ts-nocheck
import { ti } from "../taichi"
import { assertEqual } from "./Utils"

async function testStruct(): Promise<boolean> {
    console.log("testStruct")

    await ti.init()

    let S1 = ti.types.struct({
        f: ti.f32,
        f3: ti.types.vector(ti.f32, 3),
        i4: ti.types.vector(ti.i32, 4),
    })

    let S2 = ti.types.struct({
        i: ti.i32,
        s1: S1
    })

    let f1 = ti.field(S1, [4])
    let f2 = ti.field(S2, [2])
    ti.addToKernelScope({ f1, f2 })

    let kernel = ti.kernel(
        () => {
            f1[0] = {
                f: 0.1,
                f3: [0.2, 0.3, 0.4],
                i4: [1, 2, 3, 4]
            }
            f1[1].f = 0.5
            f1[1].f3 = [0.6, 0.6, 0.6]
            f1[1].f3.yz = [0.7, 0.8]
            f1[1].i4 = [5, 6, 7, 8]

            let s1Temp1 = f1[0]
            f1[2] = s1Temp1

            let s1Temp2 = {
                f: 0.5,
                f3: [0.6, 0.7, 0.8],
                i4: [5, 6, 7, 8]
            }
            f1[3] = s1Temp2

            f2[0] = {
                i: 0,
                s1: f1[0]
            }
            let s2Temp1 = {
                i: 1,
                s1: f2[0].s1
            }
            s2Temp1.s1 = {
                f: 0.5,
                f3: [0.6, 0.7, 0.8],
                i4: [5, 6, 7, 8]
            }
            f2[1] = s2Temp1
        }
    )

    let passed = true

    kernel()

    let f1Host = await f1.toArray()
    let f2Host = await f2.toArray()
    console.log(f1Host, f2Host)

    passed &&= assertEqual(f1Host, [
        {
            f: 0.1,
            f3: [0.2, 0.3, 0.4],
            i4: [1, 2, 3, 4]
        },
        {
            f: 0.5,
            f3: [0.6, 0.7, 0.8],
            i4: [5, 6, 7, 8]
        },
        {
            f: 0.1,
            f3: [0.2, 0.3, 0.4],
            i4: [1, 2, 3, 4]
        },
        {
            f: 0.5,
            f3: [0.6, 0.7, 0.8],
            i4: [5, 6, 7, 8]
        },
    ])

    passed &&= assertEqual(f2Host, [
        {
            i: 0,
            s1: {
                f: 0.1,
                f3: [0.2, 0.3, 0.4],
                i4: [1, 2, 3, 4]
            }
        },
        {
            i: 1,
            s1: {
                f: 0.5,
                f3: [0.6, 0.7, 0.8],
                i4: [5, 6, 7, 8]
            },
        }
    ])

    let val1 = {
        f: 0.6,
        f3: [0.7, 0.8, 0.9],
        i4: [9, 0, 1, 2]
    }
    await f1.set([0], val1)
    passed &&= assertEqual(await f1.get([0]), val1)

    let val2 = {
        i: 123,
        s1: val1
    }
    await f2.set([0], val2)
    passed &&= assertEqual(await f2.get([0]), val2)


    return passed
}

export { testStruct }