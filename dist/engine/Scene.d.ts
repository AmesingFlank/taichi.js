import { Field } from "../data/Field";
import { Material } from "./Material";
import { Vertex, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { LightInfo } from "./LightInfo";
import { HdrTexture } from "./HDRLoader";
export interface SceneData {
    vertexBuffer: Field;
    indexBuffer: Field;
    materialInfoBuffer: Field;
    nodesBuffer: Field;
    lightsInfoBuffer: Field | undefined;
}
export declare class Scene {
    constructor();
    vertices: Vertex[];
    indices: number[];
    materials: Material[];
    nodes: SceneNode[];
    rootNode: number;
    meshes: Mesh[];
    lights: LightInfo[];
    ibl: HdrTexture | undefined;
    vertexAttribSet: VertexAttribSet;
    getKernelData(): Promise<SceneData>;
    init(): void;
    computeGlobalTransforms(): void;
    merge(scene: Scene): void;
}
