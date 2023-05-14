//@ts-nocheck
import { assertEqual } from './Utils';

async function testLibraryFuncs(): Promise<boolean> {
    console.log('testLibraryFuncs');

    await ti.init();

    let f2 = ti.Matrix.field(2, 2, ti.f32, [5]);
    let f3 = ti.Matrix.field(3, 3, ti.f32, [3]);
    ti.addToKernelScope({ f2, f3 });

    let kernel = ti.kernel(() => {
        //@ts-ignore
        let m2 = [
            [1.0, 2.0],
            [3.0, 4.0],
        ];
        let polar2DResult = ti.polarDecompose2D(m2);
        let svd2DResult = ti.svd2D(m2);
        f2[0] = polar2DResult.U;
        f2[1] = polar2DResult.P;
        f2[2] = svd2DResult.U;
        f2[3] = svd2DResult.E;
        f2[4] = svd2DResult.V;

        let m3 = [
            [1.0, 2.0, 3.0],
            [4.0, 5.0, 6.0],
            [7.0, 8.0, 9.0],
        ];
        let svd3DResult = ti.svd3D(m3);
        f3[0] = svd3DResult.U;
        f3[1] = svd3DResult.E;
        f3[2] = svd3DResult.V;
    });

    kernel();

    let f2Host = await f2.toArray1D();
    console.log(f2Host);
    let expected2 = [
        // u
        0.9805807, -0.19611613, 0.19611613, 0.9805807,
        // p
        1.5689291, 2.745626, 2.7456257, 3.5300906,
        // U
        -0.40455358, 0.9145143, -0.9145143, -0.40455358,
        // S
        5.4649857, 0, 0, -0.36596619,
        // V
        -0.57604844, 0.81741556, -0.81741556, -0.57604844,
    ];

    let f3Host = await f3.toArray();
    console.log(f3Host);
    let expected3 = [
        [
            [-0.214837, -0.887231, -0.408248],
            [-0.520588, -0.249644, 0.816496],
            [-0.826337, 0.387943, -0.408248],
        ],
        [
            [16.8481, 0, 0],
            [0, 1.06837, 0],
            [0, 0, -4.86675e-8],
        ],
        [
            [-0.479671, 0.776689, 0.408253],
            [-0.572368, 0.0756911, -0.816496],
            [-0.665064, -0.62532, 0.408245],
        ],
    ];
    return assertEqual(f2Host, expected2) && assertEqual(f3Host, expected3, 1e-4);
}

export { testLibraryFuncs };
