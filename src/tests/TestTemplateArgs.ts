//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testTemplateArgs(): Promise<boolean> {
    console.log('testTemplateArgs');

    await ti.init();

    let i = 12345;
    let f = 1.1;
    let v = [1.1, 2.2];
    let m = [
        [1.1, 2.2],
        [3.3, 4.4],
    ];
    let o = {
        i: i,
        f: f,
        v: v,
        m: m,
    };

    let iType = ti.i32;
    let fType = ti.f32;
    let vType = ti.types.vector(ti.f32, 2);
    let mType = ti.types.matrix(ti.f32, 2, 2);
    let oType = ti.types.struct({
        i: iType,
        f: fType,
        v: vType,
        m: mType,
    });

    let iField = ti.field(iType, [1]);
    let fField = ti.field(fType, [1]);
    let vField = ti.field(vType, [1]);
    let mField = ti.field(mType, [1]);
    let oField = ti.field(oType, [1]);

    let kernel = ti.kernel(
        {
            i: ti.template(),
            f: ti.template(),
            v: ti.template(),
            m: ti.template(),
            o: ti.template(),
            iField: ti.template(),
            fField: ti.template(),
            mField: ti.template(),
            vField: ti.template(),
            oField: ti.template(),
        },
        (i, f, v, m, o, iField, fField, vField, mField, oField) => {
            iField[0] = i;
            fField[0] = f;
            vField[0] = v;
            mField[0] = m;
            oField[0] = o;
        }
    );
    await kernel(i, f, v, m, o, iField, fField, vField, mField, oField);

    console.log(await iField.get([0]));
    console.log(await fField.get([0]));
    console.log(await vField.get([0]));
    console.log(await mField.get([0]));
    console.log(await oField.get([0]));

    let passed =
        true &&
        assertEqual(await iField.get([0]), i) &&
        assertEqual(await fField.get([0]), f) &&
        assertEqual(await vField.get([0]), v) &&
        assertEqual(await mField.get([0]), m) &&
        assertEqual(await oField.get([0]), o);

    let iField2 = ti.field(iType, [1]);
    let i2 = 54321;
    await kernel(i2, f, v, m, o, iField2, fField, vField, mField, oField);
    console.log(await iField2.get([0]));
    passed &&= assertEqual(await iField2.get([0]), i2);

    return passed;
}

export { testTemplateArgs };
