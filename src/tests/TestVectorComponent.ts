//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testVectorComponent(): Promise<boolean> {
    console.log('testVectorComponent');

    await ti.init();

    let f = ti.Vector.field(2, ti.f32, 1);
    let res = [2, 4];
    ti.addToKernelScope({ f, res });

    let kernel1 = ti.kernel(() => {
        //@ts-ignore
        for (let i of range(1)) {
            f[i] = [i + 1, i + 1];
        }
    });
    let kernel2 = ti.kernel(() => {
        //@ts-ignore
        for (let i of range(1)) {
            let x = f[i] * [2, 3] + [0.5, 0.0];
            x[0] = x[0] * res[0];
            x[1] = x[1] * res[1];
            let ix = i32(x);
            f[i] = x;
        }
    });

    kernel1();
    kernel2();

    let fHost = await f.toArray1D();
    console.log(fHost);
    return assertEqual(fHost, [5, 12]);
}

export { testVectorComponent };
