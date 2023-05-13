//@ts-nocheck
import * as ti from '../taichi'
import { assertEqual } from './Utils'

async function testBroadcast(): Promise<boolean> {
    console.log('testBroadcast')

    await ti.init()

    let m = ti.Matrix.field(2, 2, ti.i32, [1])
    let v = ti.Vector.field(2, ti.i32, [1])
    ti.addToKernelScope({ m, v })

    let kernel = ti.kernel(() => {
        m[0] = 1
        v[0] = 1 + [2, 3]
    })

    kernel()

    let mHost = await m.toArray1D()
    let vHost = await v.toArray1D()
    console.log(mHost, vHost)
    return assertEqual(mHost, [1, 1, 1, 1]) && assertEqual(vHost, [3, 4])
}

export { testBroadcast }
