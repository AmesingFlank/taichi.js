import { Transform } from './Transform';
import * as ti from '../taichi';
export class SceneNode {
    constructor() {}
    parent: number = -1;
    children: number[] = [];
    localTransform: Transform = new Transform();
    globalTransform: Transform = new Transform();
    mesh: number = -1;
    static getKernelType() {
        return ti.types.struct({
            globalTransform: Transform.getKernelType(),
        });
    }
}
