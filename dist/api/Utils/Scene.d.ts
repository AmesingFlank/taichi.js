import { Field } from "../../data/Field";
import { Material } from "./Material";
import { Vertex, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo } from "./DrawInfo";
import { InstanceInfo } from "./InstanceInfo";
export interface SceneData {
    vertexBuffer: Field;
    indexBuffer: Field;
    drawInfoBuffers: Field[];
    drawInstanceInfoBuffers: Field[];
    materialInfoBuffer: Field;
    nodesBuffer: Field;
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
    materialDrawInstanceInfos: InstanceInfo[][];
    vertexAttribSet: VertexAttribSet;
    getKernelData(): Promise<SceneData>;
    computeDrawInfo(): void;
    computeGlobalTransforms(): void;
}
