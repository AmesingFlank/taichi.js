export declare class MeshPrimitive {
    firstIndex: number;
    indexCount: number;
    materialID: number;
    constructor(firstIndex: number, indexCount: number, materialID: number);
}
export declare class Mesh {
    primitives: MeshPrimitive[];
    constructor(primitives?: MeshPrimitive[]);
}
