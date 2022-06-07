import * as ti from "../taichi";
export declare class Transform {
    constructor(matrix?: number[][]);
    reset(): void;
    matrix: number[][];
    mul(other: Transform): ti.engine.Transform;
    static getKernelType(): import("../frontend/Type").StructType;
}
