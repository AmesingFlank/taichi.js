import { Field } from "../../data/Field";
import { Material } from "./Material";
import { Vertex, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo } from "./DrawInfo";
import { InstanceInfo } from "./InstanceInfo";
import { BatchInfo } from "./BatchInfo";
export interface SceneData {
    vertexBuffer: Field;
    indexBuffer: Field;
    batchesDrawInfoBuffers: Field[];
    batchesDrawInstanceInfoBuffers: Field[];
    materialInfoBuffer: Field;
    nodesBuffer: Field;
}
export declare class Scene {
    constructor();
    vertices: Vertex[];
    indices: number[];
    materials: Material[];
    nodes: SceneNode[];
    rootNodes: number[];
    meshes: Mesh[];
    batchInfos: BatchInfo[];
    batchesDrawInfos: DrawInfo[][];
    batchesDrawInstanceInfos: InstanceInfo[][];
    vertexAttribSet: VertexAttribSet;
    getKernelData(): Promise<SceneData>;
    init(): void;
    computeDrawBatches(): void;
    computeGlobalTransforms(): void;
}
