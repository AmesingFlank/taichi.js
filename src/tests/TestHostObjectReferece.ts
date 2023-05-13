//@ts-nocheck
import { assertEqual } from './Utils'

async function testHostObjectReference(): Promise<boolean> {
    console.log('testHostObjectReference')

    await ti.init()

    let f0 = ti.field(ti.f32, 1)
    let f2 = ti.field(ti.f32, 1)

    let data = [
        {
            valueWanted: 123,
            field: f0,
        },
        {
            valueWanted: 456,
            field: undefined,
        },
        {
            valueWanted: 789,
            field: f2,
        },
    ]

    ti.addToKernelScope({ data })

    let kernel = ti.kernel(() => {
        for (let i of ti.static(range(3))) {
            if (ti.static(data[i].field !== undefined)) {
                data[i].field[0] = data[i].valueWanted
            }
        }
    })

    kernel()

    let passed = true

    for (let i = 0; i < 3; ++i) {
        if (data[i].field !== undefined) {
            console.log(await data[i].field!.toArray(), data[i].valueWanted)
            passed &&= assertEqual(await data[i].field!.get([0]), data[i].valueWanted)
        }
    }
    return passed
}

export { testHostObjectReference }
