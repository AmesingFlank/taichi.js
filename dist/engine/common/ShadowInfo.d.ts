export declare class ShadowInfo {
    physicalSize: number[];
    maxDistance: number;
    shadowMapResolution: number[];
    constructor(physicalSize: number[], maxDistance: number, shadowMapResolution?: number[]);
    view: number[][];
    projection: number[][];
    viewProjection: number[][];
}
