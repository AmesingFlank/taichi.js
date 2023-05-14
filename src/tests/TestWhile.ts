//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testWhile(): Promise<boolean> {
    console.log('testWhile');

    await ti.init();

    let f = ti.field(ti.i32, [10]);
    ti.addToKernelScope({ f });

    let kernel = ti.kernel(function k() {
        //@ts-ignore
        let i = 0;
        while (i < 5) {
            f[i] = i;
            i = i + 1;
        }
    });

    kernel();

    let fHost = await f.toArray1D();
    console.log(fHost);
    return assertEqual(fHost, [0, 1, 2, 3, 4, 0, 0, 0, 0, 0]);
}

export { testWhile };
