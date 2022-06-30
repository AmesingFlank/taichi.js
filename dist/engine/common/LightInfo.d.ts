import { ShadowInfo } from "./ShadowInfo";
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
    castsShadow: boolean;
    shadow: ShadowInfo | undefined;
    constructor(type: LightType, brightness: number, color: number[], influenceRadius: number, position?: number[], // point and spot
    direction?: number[], // spot and dir
    innerConeAngle?: number, outerConeAngle?: number, castsShadow?: boolean, shadow?: ShadowInfo | undefined);
    static getKernelType(): import("../../language/frontend/Type").StructType;
}
export declare class PointLightInfo extends LightInfo {
    constructor(brightness: number, color: number[], influenceRadius: number, position: number[], castsShadow?: boolean, shadow?: ShadowInfo | undefined);
}
export declare class SpotLightInfo extends LightInfo {
    innerConeAngle: number;
    outerConeAngle: number;
    constructor(brightness: number, color: number[], influenceRadius: number, position: number[], direction: number[], // spot and dir
    innerConeAngle?: number, outerConeAngle?: number, castsShadow?: boolean, shadow?: ShadowInfo | undefined);
}
export declare class DirectionalLightInfo extends LightInfo {
    constructor(brightness: number, color: number[], direction: number[], // spot and dir 
    castsShadow?: boolean, shadowStartingPosition?: number[], shadow?: ShadowInfo | undefined);
}
