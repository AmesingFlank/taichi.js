export declare class DrawInfo {
    indexCount: number;
    instanceCount: number;
    firstIndex: number;
    baseVertex: number;
    firstInstance: number;
    constructor(indexCount?: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number);
}
export declare const drawInfoKernelType: import("../../frontend/Type").StructType;
