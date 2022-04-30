import { Transform } from "./Transform";
export declare class SceneNode {
    constructor();
    parent: number;
    children: number[];
    transform: Transform;
    mesh: number;
}
