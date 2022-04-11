//@ts-nocheck
import * as ti from "../taichi"
import { assertEqual } from "./Utils"

async function testTypes(): Promise<boolean> {
    console.log("testTypes")

    await ti.init()

    let vecType = ti.types.vector(ti.i32, 3)
    let matType = ti.types.matrix(ti.f32, 2, 2)

    let m = ti.field(matType, [1])
    let v = ti.field(vecType, [1])
    ti.addToKernelScope({ m, v })

    let kernel = ti.kernel(
        () => {
            v[0] = [0, 1, 2]
            m[0] = [[0, 1], [2, 3]]
        }
    )

    kernel()

    let mHost = await m.toArray1D()
    let vHost = await v.toArray1D()
    console.log(mHost, vHost)
    return assertEqual(mHost, [0, 1, 2, 3])
        && assertEqual(vHost, [0, 1, 2])
}

export { testTypes }