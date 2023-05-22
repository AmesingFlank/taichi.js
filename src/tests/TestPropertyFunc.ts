//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testPropertyFunc(): Promise<boolean> {
    console.log('testPropertyFunc');

    await ti.init();

    let f = ti.field(ti.f32, [13]);

    let dot_f = (x, y) => x.dot(y);

    ti.addToKernelScope({ f, dot_f });
    let kernel = ti.kernel(() => {
        //@ts-ignore
        let x = [3.0, 4.0];
        f[0] = x.norm();
        f[1] = x.normSqr();
        f[2] = x.length();
        f[3] = x.sum();

        f[4] = [3.0, 4.0].norm();
        f[5] = [3.0, 4.0].normSqr();
        f[6] = [3.0, 4.0].length();
        f[7] = [3.0, 4.0].sum();

        let y = [1.0, 2.0];
        f[8] = dot(x, y);
        f[9] = x.dot(y);
        f[10] = dot_f(x, y);

        f[11] = [3.0, 4.0].normalized().x;
        f[12] = [3.0, 4.0].normalized().y;
    });

    kernel();

    let fHost = await f.toArray1D();
    console.log(fHost);
    return assertEqual(fHost, [5, 25, 2, 7, 5, 25, 2, 7, 11, 11, 11, 0.6, 0.8]);
}

export { testPropertyFunc };
