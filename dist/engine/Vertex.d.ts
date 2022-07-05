export declare enum VertexAttrib {
    None = 0,
    Position = 1,
    Normal = 2,
    Tangent = 4,
    TexCoords0 = 8,
    TexCoords1 = 16,
    Color = 32,
    Joints = 64,
    Weights = 128,
    Max = 129,
    All = 127
}
export declare class VertexAttribSet {
    val: number;
    constructor(val: number);
    test(attrib: VertexAttrib): boolean;
    set(attrib: VertexAttrib): void;
    foreach(f: (attrib: VertexAttrib) => any): void;
}
export declare function getVertexAttribNumComponents(attrib: VertexAttrib): 2 | 3 | 4 | -1;
export declare function getVertexAttribSetKernelType(attribs: VertexAttribSet): import("../language/frontend/Type").StructType;
export declare class Vertex {
    attribs: VertexAttribSet;
    constructor(attribs: VertexAttribSet);
    setAttribValue(attrib: VertexAttrib, value: number[]): void;
    ensureAttrib(attrib: VertexAttrib): void;
    ensureAttribs(attribs: VertexAttribSet): void;
    position: number[] | null;
    normal: number[] | null;
    tangent: number[] | null;
    texCoords0: number[] | null;
    texCoords1: number[] | null;
    color: number[] | null;
    joints: number[] | null;
    weights: number[] | null;
}
