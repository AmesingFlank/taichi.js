//@ts-nocheck
import * as ti from '../taichi'
import { assertEqual } from './Utils'

async function testMatrixOps(): Promise<boolean> {
    console.log('testMatrixOps')

    await ti.init()

    let f = ti.Matrix.field(2, 2, ti.f32, [4])
    let v = ti.Vector.field(2, ti.f32, [1])
    ti.addToKernelScope({ f, v })

    let kernel = ti.kernel(() => {
        //@ts-ignore
        let m1 = [
            [1, 2],
            [3, 4],
        ]
        let m2 = [
            [5, 6],
            [7, 8],
        ]
        let m3 = m1.matmul(m2)
        f[0] = m3
        f[1] = m2.transpose()
        f[2] = m1.transpose().transpose()
        f[3] = [1, 2].outer_product([3, 4])
        let v1 = [9, 10]
        let v2 = m1.matmul(v1)
        v[0] = v2
    })

    kernel()

    let fHost = await f.toArray1D()
    let vHost = await v.toArray1D()
    console.log(fHost, vHost)
    return assertEqual(fHost, [19, 22, 43, 50, 5, 7, 6, 8, 1, 2, 3, 4, 3, 4, 6, 8]) && assertEqual(vHost, [29, 67])
}

export { testMatrixOps }
