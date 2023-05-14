//@ts-nocheck
import * as ti from '../taichi';
import { assertEqual } from './Utils';

async function testRets(): Promise<boolean> {
    console.log('testRets');

    await ti.init();

    let scalar = 1;
    let vector = [2, 3];
    let matrix = [[4, 5]];
    let struct = {
        s: 6.6,
        v: [7.7, 8.8],
    };
    let nestedStruct = {
        s: 9,
        v: [10, 11],
        ss: struct,
    };

    ti.addToKernelScope({ scalar, vector, matrix, struct, nestedStruct });

    let kScalar = ti.kernel(() => {
        return scalar;
    });

    let kVector = ti.kernel(() => {
        return vector;
    });

    let kMatrix = ti.kernel(() => {
        return matrix;
    });

    let kStruct = ti.kernel(() => {
        return struct;
    });

    let kNestedStruct = ti.kernel(() => {
        return nestedStruct;
    });

    let scalarResult = await kScalar();
    let vectorResult = await kVector();
    let matrixResult = await kMatrix();
    let structResult = await kStruct();
    let nestedStructResult = await kNestedStruct();

    console.log(scalarResult, vectorResult, matrixResult, structResult, nestedStructResult);

    return (
        assertEqual(scalar, scalarResult) &&
        assertEqual(vector, vectorResult) &&
        assertEqual(matrix, matrixResult) &&
        assertEqual(struct, structResult) &&
        assertEqual(nestedStruct, nestedStructResult)
    );
}

export { testRets };
