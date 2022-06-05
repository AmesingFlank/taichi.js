export declare class DrawInfo {
    indexCount: number;
    instanceCount: number;
    firstIndex: number;
    baseVertex: number;
    firstInstance: number;
    constructor(indexCount?: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number);
    static getKernelType(): import("../../frontend/Type").StructType;
}
