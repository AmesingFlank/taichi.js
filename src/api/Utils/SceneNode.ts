import { Transform } from "./Transform"

export class SceneNode {
    constructor(){

    }
    parent: number = -1
    children: number[] = []
    transform: Transform = new Transform
    mesh: number = -1
}