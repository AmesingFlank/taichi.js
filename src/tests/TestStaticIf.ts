//@ts-nocheck
import { assertEqual } from './Utils'

async function testStaticIf(): Promise<boolean> {
    console.log('testStaticIf')

    await ti.init()

    let f = ti.field(ti.i32, 6)

    let data0 = [123]

    let data1 = {
        x: 456,
        y: 567,
        z: [f, f],
    }

    ti.addToKernelScope({ f, data0, data1 })

    let kernel = ti.kernel(() => {
        if (ti.static(1)) {
            f[0] = 1
        } else {
            a.b().c().d()
        }

        if (ti.static(data0[0] === data0[0])) {
            f[1] = 1
        } else {
            a.b().c().d()
        }

        if (ti.static(data1 === undefined)) {
            a.b().c().d()
        } else {
            f[2] = 1
        }

        if (ti.static(data1.x > data1.y)) {
            a.b().c().d()
        } else {
            f[3] = 1
        }

        if (ti.static(data1.z[1] === undefined)) {
            a.b().c().d()
        } else {
            f[4] = 1
        }

        if (ti.static(data1.z[2] === undefined)) {
            f[5] = 1
        } else {
            a.b().c().d()
        }
    })

    kernel()

    let fHost = await f.toArray()
    console.log(fHost)
    return assertEqual(fHost, [1, 1, 1, 1, 1, 1])
}

export { testStaticIf }
