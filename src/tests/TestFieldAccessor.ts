//@ts-nocheck
import { ti } from "../taichi"
import { assertEqual } from "./Utils"

async function testFieldAccessor(): Promise<boolean> {
    console.log("testFieldAccessor")

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
                    s2[[i, j]] = index
                    v2[[i, j]] = [index * 2, index * 2 + 1]
                    m2[[i, j]] = [[4 * index, 4 * index + 1], [4 * index + 2, 4 * index + 3]]
                    for (let k of range(2)) {
                        let index = i * 4 + j * 2 + k
                        s3[[i, j, k]] = index
                        v3[[i, j, k]] = [index * 2, index * 2 + 1]
                    }
                }
            }
        }
    )

    kernel()

    let passed = true

    console.log(await s1.get([1]))
    console.log(await s2.get([1, 1]))
    console.log(await s3.get([1, 0, 1]))
    console.log(await v1.get([1]))
    console.log(await v2.get([1, 0]))
    console.log(await v3.get([1, 1, 0]))
    console.log(await m1.get([0]))
    console.log(await m2.get([1, 1]))

    passed &&= assertEqual(await s1.get([1]), 1)
        && assertEqual(await s2.get([1, 1]), 3)
        && assertEqual(await s3.get([1, 0, 1]), 5)
        && assertEqual(await v1.get([1]), [2, 3])
        && assertEqual(await v2.get([1, 0]), [4, 5])
        && assertEqual(await v3.get([1, 1, 0]), [12, 13])
        && assertEqual(await m1.get([0]), [[0, 1], [2, 3]])
        && assertEqual(await m2.get([1, 1]), [[12, 13], [14, 15]])

    await s1.set([0], 123)
    passed &&= assertEqual(await s1.get([0]), 123)

    await s2.set([0, 1], 456.333)
    passed &&= assertEqual(await s2.get([0, 1]), 456.333,  1e-5)

    await s3.set([0, 1, 0], 789)
    passed &&= assertEqual(await s3.get([0, 1, 0]), 789)

    await v1.set([1], [123, 456])
    passed &&= assertEqual(await v1.get([1]), [123, 456])

    await v2.set([1, 0], [456.789, 789.456])
    passed &&= assertEqual(await v2.get([1, 0]), [456.789, 789.456], 1e-5)

    await v3.set([1, 1, 1], [10, 11])
    passed &&= assertEqual(await v3.get([1, 1, 1]), [10, 11])

    await m1.set([1], [[1, 23], [4, 56]])
    passed &&= assertEqual(await m1.get([1]), [[1, 23], [4, 56]])

    await m2.set([1, 1], [[45, 6], [78, 9]])
    passed &&= assertEqual(await m2.get([1, 1]), [[45, 6], [78, 9]])

    return passed
}

export { testFieldAccessor }