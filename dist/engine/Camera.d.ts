export declare class Camera {
    position: number[];
    direction: number[];
    up: number[];
    fov: number;
    near: number;
    far: number;
    constructor(position: number[], direction: number[], up?: number[], fov?: number, near?: number, far?: number);
    static getKernelType(): any;
}
