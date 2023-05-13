//@ts-nocheck
import * as ti from '../taichi'
import { assertEqual } from './Utils'

async function testFromArray(): Promise<boolean> {
    console.log('testFromArray')

    await ti.init()

    let s1 = ti.field(ti.f32, [2])
    let s2 = ti.field(ti.f32, [2, 2])
    let s3 = ti.field(ti.f32, [2, 2, 2])

    let v1 = ti.Vector.field(2, ti.f32, [2])
    let v2 = ti.Vector.field(2, ti.f32, [2, 2])
    let v3 = ti.Vector.field(2, ti.f32, [2, 2, 2])

    let m1 = ti.Matrix.field(2, 2, ti.i32, [2])
    let m2 = ti.Matrix.field(2, 2, ti.i32, [2, 2])

    let s1Host = [0, 1]
    let s2Host = [
        [0, 1],
        [2, 3],
    ]
    let s3Host = [
        [
            [0, 1],
            [2, 3],
        ],
        [
            [4, 5],
            [6, 7],
        ],
    ]

    let v1Host = [
        [0, 1],
        [2, 3],
    ]
    let v2Host = [
        [
            [0, 1],
            [2, 3],
        ],
        [
            [4, 5],
            [6, 7],
        ],
    ]
    let v3Host = [
        [
            [
                [0, 1],
                [2, 3],
            ],
            [
                [4, 5],
                [6, 7],
            ],
        ],
        [
            [
                [8, 9],
                [10, 11],
            ],
            [
                [12, 13],
                [14, 15],
            ],
        ],
    ]

    let m1Host = [
        [
            [0, 1],
            [2, 3],
        ],
        [
            [4, 5],
            [6, 7],
        ],
    ]
    let m2Host = [
        [
            [
                [0, 1],
                [2, 3],
            ],
            [
                [4, 5],
                [6, 7],
            ],
        ],
        [
            [
                [8, 9],
                [10, 11],
            ],
            [
                [12, 13],
                [14, 15],
            ],
        ],
    ]

    await s1.fromArray(s1Host)
    await s2.fromArray(s2Host)
    await s3.fromArray(s3Host)
    await v1.fromArray(v1Host)
    await v2.fromArray(v2Host)
    await v3.fromArray(v3Host)
    await m1.fromArray(m1Host)
    await m2.fromArray(m2Host)

    let passed = true

    passed &&=
        assertEqual(await s1.toArray(), s1Host) &&
        assertEqual(await s2.toArray(), s2Host) &&
        assertEqual(await s3.toArray(), s3Host) &&
        assertEqual(await v1.toArray(), v1Host) &&
        assertEqual(await v2.toArray(), v2Host) &&
        assertEqual(await v3.toArray(), v3Host) &&
        assertEqual(await m1.toArray(), m1Host) &&
        assertEqual(await m2.toArray(), m2Host)

    let s1Host1D = s1Host.map((x) => Math.random())
    let s2Host1D = s2Host.flat(1).map((x) => Math.random())
    let s3Host1D = s3Host.flat(2).map((x) => Math.random())
    let v1Host1D = v1Host.flat(1).map((x) => Math.random())
    let v2Host1D = v2Host.flat(2).map((x) => Math.random())
    let v3Host1D = v3Host.flat(3).map((x) => Math.random())
    let m1Host1D = m1Host.flat(2).map((x) => Math.floor(Math.random() * 100))
    let m2Host1D = m2Host.flat(3).map((x) => Math.floor(Math.random() * 100))

    await s1.fromArray1D(s1Host1D)
    await s2.fromArray1D(s2Host1D)
    await s3.fromArray1D(s3Host1D)
    await v1.fromArray1D(v1Host1D)
    await v2.fromArray1D(v2Host1D)
    await v3.fromArray1D(v3Host1D)
    await m1.fromArray1D(m1Host1D)
    await m2.fromArray1D(m2Host1D)

    passed &&=
        assertEqual(await s1.toArray1D(), s1Host1D) &&
        assertEqual(await s2.toArray1D(), s2Host1D) &&
        assertEqual(await s3.toArray1D(), s3Host1D) &&
        assertEqual(await v1.toArray1D(), v1Host1D) &&
        assertEqual(await v2.toArray1D(), v2Host1D) &&
        assertEqual(await v3.toArray1D(), v3Host1D) &&
        assertEqual(await m1.toArray1D(), m1Host1D) &&
        assertEqual(await m2.toArray1D(), m2Host1D)

    return passed
}

export { testFromArray }
