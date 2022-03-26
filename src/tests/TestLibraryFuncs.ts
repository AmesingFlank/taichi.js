//@ts-nocheck
import {assertEqual} from "./Utils"

async function testLibraryFuncs(): Promise<boolean> {
    console.log("testLibraryFuncs")
     
    await ti.init() 

    let f = ti.Matrix.field(2,2, ti.f32, [5])
    ti.addToKernelScope({f}) 

    let kernel = ti.kernel(
        () => {
            //@ts-ignore
            let m1 = [[1.0, 2.0], [3.0, 4.0]]
            let zero2x2 = [[0.0, 0.0],[0.0, 0.0]]
            let u = zero2x2
            let p = zero2x2
            let U = zero2x2
            let S = zero2x2
            let V = zero2x2
            ti.polarDecompose2D(m1, u, p)
            ti.svd2D(m1, U, S, V)
            f[0] = u
            f[1] = p
            f[2] = U
            f[3] = S
            f[4] = V
        }
    )

    kernel()
    
    let fHost = await f.toArray1D()
    console.log(fHost)
    let expected = [
        // u
        0.9805807,  -0.19611613,
        0.19611613,  0.9805807,
        // p
        1.5689291,   2.745626 ,
        2.7456257,   3.5300906,
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
    return assertEqual(fHost,expected)
}

export {testLibraryFuncs}