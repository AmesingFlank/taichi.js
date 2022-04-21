import { Field } from "../../data/Field";
import { Material } from "./Material";
import { Vertex } from "./Vertex";
export interface SceneData {
    vertexBuffer: Field;
    indexBuffer: Field;
    materialInfos: Field;
    materials: Material[];
}
export declare class Scene {
    constructor();
    vertices: Vertex[];
    indices: number[];
    materials: Material[];
    getKernelData(): Promise<SceneData>;
}
