//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testSwizzle(): Promise<boolean> {
    console.log('testSwizzle');

    await ti.init();

    let f = ti.field(ti.f32, [10]);
    let v = ti.Vector.field(4, ti.f32, [2]);
    ti.addToKernelScope({ f, v });
    let kernel = ti.kernel(() => {
        //@ts-ignore
        let v0 = [0.0, 1.0, 2.0, 3.0];
        let v1 = v0.xyzw;
        f[0] = v1.x;
        f[1] = v1.y;
        f[2] = v1.z;
        f[3] = v1.w;

        let v2 = [0.0, 1.0, 2.0, 3.0].bgra;
        f[4] = v2.r;
        f[5] = v2.g;
        f[6] = v2.b;
        f[7] = v2.a;

        let v3 = [0.0, 1.0].uv;
        f[8] = v3.v;
        f[9] = v3.u;

        let v4 = [0.0, 0.0, 0.0, 0.0];
        v4.x = 1;
        v4.y = 2;
        v4.z = 3;
        v4.w = 4;
        v[0] = v4;

        let v5 = [0.0, 0.0, 0.0, 0.0];
        v5.wzyx = [1, 2, 3, 4].wzwz;
        v[1] = v5;
    });

    kernel();

    let fHost = await f.toArray1D();
    let vHost = await v.toArray1D();
    console.log(fHost, vHost);

    return assertEqual(fHost, [0, 1, 2, 3, 2, 1, 0, 3, 1, 0]) && assertEqual(vHost, [1, 2, 3, 4, 3, 4, 3, 4]);
}

export { testSwizzle };
