import { Vertex, VertexAttribSet } from "./Vertex";
import { Scene } from "./Scene";
import { Material } from "./Material";
export declare class ObjLoader {
    static loadFromURL(url: string): Promise<Scene>;
    static getNewVertex(position: number[], attribs: VertexAttribSet): Vertex;
}
export declare class MtlLoader {
    static loadFromURL(url: string): Promise<Material[]>;
}
