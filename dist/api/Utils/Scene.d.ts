import { Field } from "../../data/Field";
import { Material } from "./Material";
import { Vertex, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo } from "./DrawInfo";
export interface SceneData {
    vertexBuffer: Field;
    indexBuffer: Field;
    drawInfoBuffers: Field[];
    materialInfosBuffer: Field;
    materials: Material[];
    drawInfos: DrawInfo[][];
}
export declare class Scene {
    constructor();
    vertices: Vertex[];
    indices: number[];
    materials: Material[];
    nodes: SceneNode[];
    rootNodes: number[];
    meshes: Mesh[];
    materialDrawInfos: DrawInfo[][];
    vertexAttribSet: VertexAttribSet;
    getKernelData(): Promise<SceneData>;
    computeDrawInfo(): DrawInfo[][];
}
