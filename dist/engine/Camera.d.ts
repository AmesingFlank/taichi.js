export declare class Camera {
    position: number[];
    direction: number[];
    up: number[];
    fov: number;
    near: number;
    far: number;
    constructor(position: number[], direction: number[], up?: number[], fov?: number, near?: number, far?: number);
    view: number[][];
    projection: number[][];
    viewProjection: number[][];
    computeMatrices(aspectRatio: number): void;
    static getKernelType(): any;
    track(canvas: HTMLCanvasElement, yawSpeed?: number, pitchSpeed?: number, movementSpeed?: number): void;
}
