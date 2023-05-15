import { Transform } from './Transform';
export declare class SceneNode {
    constructor();
    parent: number;
    children: number[];
    localTransform: Transform;
    globalTransform: Transform;
    mesh: number;
    static getKernelType(): import("../language/frontend/Type").StructType;
}
