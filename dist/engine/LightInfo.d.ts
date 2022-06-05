export declare enum LightType {
    Point = 1
}
export declare class LightInfo {
    type: LightType;
    position: number[];
    brightness: number;
    color: number[];
    influenceRadius: number;
    constructor(type: LightType, position: number[], brightness: number, color: number[], influenceRadius: number);
    static getKernelType(): import("../frontend/Type").StructType;
}
