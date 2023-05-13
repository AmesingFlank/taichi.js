//@ts-nocheck
import { Field } from '../data/Field'
import * as ti from '../taichi'
import { assertEqual } from './Utils'

async function testClassKernel(): Promise<boolean> {
    console.log('testClassKernel')

    await ti.init()

    class C {
        constructor() {
            this.f = ti.field(ti.f32, [1])
            this.k = ti.classKernel(this, () => {
                this.f[0] = this.x
                return this.x
            })
            this.tk = ti.classKernel(
                this,
                { f: ti.template(), x: ti.f32 }, // arg type annotation
                (f, x) => {
                    f[0] = x
                    return x
                }
            )
        }
        f: Field
        x: number = 3
        k: (...args: any[]) => any
    }

    let c = new C()
    let passed = true

    let kResult = await c.k()
    let cfHost = await c.f.toArray()
    console.log(kResult, cfHost)
    passed &&= assertEqual(kResult, 3)
    passed &&= assertEqual(cfHost, [3])

    let f = ti.field(ti.f32, [1])
    let tkResult = await c.tk(f, 5)
    let fHost = await f.toArray()
    console.log(tkResult, fHost)
    passed &&= assertEqual(tkResult, 5)
    passed &&= assertEqual(fHost, [5])

    return passed
}

export { testClassKernel }
