import { Field } from "../data/Field";
import { Material } from "./Material";
import { Vertex, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { Transform } from "./Transform";
import { LightInfo } from "./common/LightInfo";
import { HdrTexture } from "./loaders/HDRLoader";
import { ShadowInfo } from "./common/ShadowInfo";
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
    iblIntensity: number;
    iblShadows: ShadowInfo[];
    vertexAttribSet: VertexAttribSet;
    getKernelData(): Promise<SceneData>;
    init(): void;
    computeGlobalTransforms(): void;
    add(scene: Scene, transform?: Transform): Promise<number>;
    addGLTF(url: string, transform?: Transform): Promise<number>;
}
