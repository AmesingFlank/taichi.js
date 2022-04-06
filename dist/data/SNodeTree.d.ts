/// <reference types="dist" />
import { Field } from './Field';
import { NativeTaichiAny } from "../native/taichi/GetTaichi";
import { Type } from "../frontend/Type";
declare class SNodeTree {
    treeId: number;
    fields: Field[];
    size: number;
    nativeTreeRoot: NativeTaichiAny;
    rootBuffer: GPUBuffer | null;
    constructor();
    addNaiveDenseField(elementType: Type, dimensionsArg: number[] | number): Field;
}
export { SNodeTree };
