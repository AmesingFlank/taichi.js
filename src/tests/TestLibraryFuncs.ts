//@ts-nocheck
import { assertEqual } from "./Utils"

async function testLibraryFuncs(): Promise<boolean> {
    console.log("testLibraryFuncs")

    await ti.init()

    let f2 = ti.Matrix.field(2, 2, ti.f32, [5])
    let f3 = ti.Matrix.field(3, 3, ti.f32, [3])
    ti.addToKernelScope({ f2, f3 })

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            let m2 = [[1.0, 2.0], [3.0, 4.0]]
            let zero2x2 = [[0.0, 0.0], [0.0, 0.0]]
            let u2 = zero2x2
            let p2 = zero2x2
            let U2 = zero2x2
            let S2 = zero2x2
            let V2 = zero2x2
            ti.polarDecompose2D(m2, u2, p2)
            ti.svd2D(m2, U2, S2, V2)
            f2[0] = u2
            f2[1] = p2
            f2[2] = U2
            f2[3] = S2
            f2[4] = V2

            let m3 = [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], [7.0, 8.0, 9.0]]
            let zero3x3 = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]]
            let U3 = zero3x3
            let S3 = zero3x3
            let V3 = zero3x3 
            ti.svd3D(m3, U3, S3, V3)
            f3[0] = U3
            f3[1] = S3
            f3[2] = V3
        }
    )

    kernel()

    let f2Host = await f2.toArray1D()
    console.log(f2Host)
    let expected2 = [
        // u
        0.9805807, -0.19611613,
        0.19611613, 0.9805807,
        // p
        1.5689291, 2.745626,
        2.7456257, 3.5300906,
        // U
        -0.40455358, 0.9145143,
        -0.9145143, -0.40455358,
        // S
        5.4649857, 0,
        0, -0.36596619,
        // V
        -0.57604844, 0.81741556,
        -0.81741556, -0.57604844
    ]

    let f3Host = await f3.toArray()
    console.log(f3Host)
    let expected3 = [
        [
            [-0.214837, -0.887231, -0.408248], 
            [-0.520588, -0.249644, 0.816496], 
            [-0.826337, 0.387943, -0.408248]
        ],
        [
            [16.8481, 0, 0], 
            [0, 1.06837, 0], 
            [0, 0, -4.86675e-08]
        ],
        [
            [-0.479671, 0.776689, 0.408253], 
            [-0.572368, 0.0756911, -0.816496], 
            [-0.665064, -0.62532, 0.408245]
        ]
    ]
    return assertEqual(f2Host, expected2) && assertEqual(f3Host, expected3, 1e-4)
}

export { testLibraryFuncs }