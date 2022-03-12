//@ts-nocheck
import { ti } from "../taichi"
import { assertArrayEqual } from "./Utils"

async function testToArray(): Promise<boolean> {
    console.log("testToArray")

    await ti.init()


    let s1 = ti.field(ti.f32, [2])
    let s2 = ti.field(ti.f32, [2, 2])
    let s3 = ti.field(ti.f32, [2, 2, 2])

    let v1 = ti.Vector.field(2, ti.f32, [2])
    let v2 = ti.Vector.field(2, ti.f32, [2, 2])
    let v3 = ti.Vector.field(2, ti.f32, [2, 2, 2])

    let m1 = ti.Matrix.field(2, 2, ti.i32, [2])
    let m2 = ti.Matrix.field(2, 2, ti.i32, [2, 2])

    ti.addToKernelScope({ s1, s2, s3, v1, v2, v3, m1, m2 })

    let kernel = ti.kernel(
        () => {
            for (let i of range(2)) {
                s1[i] = i
                v1[i] = [2 * i, 2 * i + 1]
                m1[i] = [[4 * i, 4 * i + 1], [4 * i + 2, 4 * i + 3]]
                for (let j of range(2)) {
                    let index = i * 2 + j
                    s2[i, j] = index
                    v2[i, j] = [index * 2, index * 2 + 1]
                    m2[i, j] = [[4 * index, 4 * index + 1], [4 * index + 2, 4 * index + 3]]
                    for (let k of range(2)) {
                        let index = i * 4 + j * 2 + k
                        s3[i, j, k] = index
                        v3[i, j, k] = [index * 2, index * 2 + 1]
                    }
                }
            }
        }
    )

    kernel()

    let s1Host = await s1.toArray()
    let s2Host = await s2.toArray()
    let s3Host = await s3.toArray()

    let v1Host = await v1.toArray()
    let v2Host = await v2.toArray()
    let v3Host = await v3.toArray()

    let m1Host = await m1.toArray()
    let m2Host = await m2.toArray()

    console.log(s1Host, s2Host, s3Host, v1Host, v2Host, v3Host, m1Host, m2Host)

    return assertArrayEqual(s1Host, [0, 1])
        && assertArrayEqual(s2Host, [[0, 1], [2, 3]])
        && assertArrayEqual(s3Host, [[[0, 1], [2, 3]], [[4, 5], [6, 7]]])
        && assertArrayEqual(v1Host, [[0, 1], [2, 3]])
        && assertArrayEqual(v2Host, [[[0, 1], [2, 3]], [[4, 5], [6, 7]]])
        && assertArrayEqual(v3Host, [[[[0, 1], [2, 3]], [[4, 5], [6, 7]]], [[[8, 9], [10, 11]], [[12, 13], [14, 15]]]])
        && assertArrayEqual(m1Host, [[[0, 1], [2, 3]], [[4, 5], [6, 7]]])
        && assertArrayEqual(m2Host, [[[[0, 1], [2, 3]], [[4, 5], [6, 7]]], [[[8, 9], [10, 11]], [[12, 13], [14, 15]]]])
}

export { testToArray }