/// <reference types="dist" />
import { Field } from './Field';
import { Type } from "../language/frontend/Type";
declare class SNodeTree {
    treeId: number;
    fields: Field[];
    size: number;
    rootBuffer: GPUBuffer | null;
    constructor();
    addNaiveDenseField(elementType: Type, dimensionsArg: number[] | number): Field;
}
export { SNodeTree };
