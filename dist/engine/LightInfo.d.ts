export declare enum LightType {
    Point = 1,
    Spot = 2,
    Directional = 3
}
export declare class LightInfo {
    type: LightType;
    brightness: number;
    color: number[];
    influenceRadius: number;
    position: number[];
    direction: number[];
    innerConeAngle: number;
    outerConeAngle: number;
    constructor(type: LightType, brightness: number, color: number[], influenceRadius: number, position?: number[], // point and spot
    direction?: number[], // spot and dir
    innerConeAngle?: number, outerConeAngle?: number);
    static getKernelType(): import("../language/frontend/Type").StructType;
}
