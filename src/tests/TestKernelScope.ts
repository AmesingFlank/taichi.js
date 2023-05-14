//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testKernelScope(): Promise<boolean> {
    console.log('testKernelScope');

    await ti.init();

    let a = 2533;
    let b = [313, 326];
    let c = [
        [313, 533],
        [326, 799],
    ];

    let f = ti.field(ti.f32, [1]);
    let v = ti.Vector.field(2, ti.f32, [1]);
    let m = ti.Matrix.field(2, 2, ti.f32, [1]);
    ti.addToKernelScope({ a, b, c, f, v, m });

    let kernel = ti.kernel(function k() {
        f[0] = (a * 2) / 2;
        v[0] = (b * 3) / 3;
        m[0] = c + 4 - 4;
    });

    kernel();

    let fHost = await f.toArray1D();
    let vHost = await v.toArray1D();
    let mHost = await m.toArray1D();

    console.log(fHost, vHost, mHost);
    return assertEqual(fHost, [a]) && assertEqual(vHost, b) && assertEqual(mHost, c[0].concat(c[1]));
}

export { testKernelScope };
