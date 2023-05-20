import type { SNodeTree } from './SNodeTree';
import { Type } from '../language/frontend/Type';
declare class Field {
    snodeTree: SNodeTree;
    offsetBytes: number;
    sizeBytes: number;
    dimensions: number[];
    elementType: Type;
    constructor(snodeTree: SNodeTree, offsetBytes: number, sizeBytes: number, dimensions: number[], elementType: Type);
    toArray1D(): Promise<number[]>;
    toInt32Array(): Promise<number[]>;
    private ensureMaterialized;
    toArray(): Promise<any[]>;
    get(indices: number[]): Promise<any>;
    fromArray1D(values: number[]): Promise<void>;
    fromArray(values: any): Promise<void>;
    set(indices: number[], value: any): Promise<void>;
}
export { Field };
