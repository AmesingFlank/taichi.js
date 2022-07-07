import * as ti from "../../taichi";
export declare class ShadowInfo {
    physicalSize: number[];
    maxDistance: number;
    shadowMapResolution: number[];
    strength: number;
    constructor(physicalSize: number[], maxDistance: number, shadowMapResolution?: number[], strength?: number);
    view: number[][];
    projection: number[][];
    viewProjection: number[][];
    static createIblShadowInfo(representativePosition: number[], representativeDirection: number[], physicalSize: number[], maxDistance: number, shadowMapResolution?: number[], strength?: number): ti.engine.ShadowInfo;
}
