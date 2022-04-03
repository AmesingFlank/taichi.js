//@ts-nocheck
import { ti } from "../taichi"
import { assertEqual } from "./Utils"

async function testLambda(): Promise<boolean> {
    console.log("testLambda")

    await ti.init()

    let f = ti.field(ti.f32, [5])

    let globalFunc = () => {
        let localFunc = () => {
            return 4
        }
        return localFunc()
    }

    ti.addToKernelScope({ f, globalFunc })

    let kernel = ti.kernel(
        () => {
            let f0 = () => {
                return 0;
            }
            function f1() {
                return 1
            }
            let f2 = (x) => {
                return x * 2
            }
            let f3 = (x) => {
                x = 3
            }
            f[0] = f0();
            f[1] = f1();
            f[2] = f2(1);
            f3(f[3])
            f[4] = globalFunc()
        }
    )

    kernel()

    let fHost = await f.toArray()
    console.log(fHost)
    return assertEqual(fHost, [0, 1, 2, 3, 4])
}

export { testLambda }