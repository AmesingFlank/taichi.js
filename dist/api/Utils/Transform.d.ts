export declare class Transform {
    constructor();
    reset(): void;
    matrix: number[][];
    mul(other: Transform): Transform;
    static getKernelType(): import("../../frontend/Type").StructType;
}
