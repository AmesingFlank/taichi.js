//@ts-nocheck
import { ti } from "../taichi"
import { assertEqual } from "./Utils"

async function testMatrix(): Promise<boolean> {
    console.log("testMatrix")

    await ti.init()

    let m = ti.Matrix.field(2, 2, ti.i32, [2, 2])
    let v = ti.Vector.field(2, ti.i32, [1])
    ti.addToKernelScope({ m, v })

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            for (let i of range(2)) {
                for (let j of range(2)) {
                    m[[i, j]][[0, 0]] = i * 1000 + j * 100
                    m[[i, j]][[0, 1]] = i * 1000 + j * 100 + 1
                    m[[i, j]][[1, 0]] = i * 1000 + j * 100 + 10
                    m[[i, j]][[1, 1]] = i * 1000 + j * 100 + 11
                }
            }
            v[0] = m[1, 1][1]
        }
    )

    kernel()

    let mHost = await m.toArray1D()
    let vHost = await v.toArray1D()
    console.log(mHost, vHost)
    return assertEqual(mHost, [0, 1, 10, 11, 100, 101, 110, 111, 1000, 1001, 1010, 1011, 1100, 1101, 1110, 1111])
        && assertEqual(vHost, [1110, 1111])
}

export { testMatrix }