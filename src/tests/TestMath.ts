//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testMath(): Promise<boolean> {
    console.log('testMath');

    await ti.init();

    let f = ti.field(ti.f32, [9]);
    ti.addToKernelScope({ f });

    let kernel = ti.kernel(function k() {
        let x = max(0.5, 0.75);
        f[0] = x;

        let c = sin(x);
        let s = cos(x);
        f[1] = c * c + s * s;

        f[2] = log(4) / log(2);

        f[3] = 3;
        f[4] = f[3] += 3; // += is considered atomic, so the value returned is the old value

        f[5] = 5;
        f[6] = f[5] *= 5; // += is not atomic, so the value returned is the new value

        let temp = 6.0;
        f[7] = temp /= 2;
        f[8] = temp;
    });

    kernel();

    let fHost = await f.toArray1D();
    console.log(fHost);
    return assertEqual(fHost, [0.75, 1, 2, 6, 3, 25, 25, 3, 3]);
}

export { testMath };
