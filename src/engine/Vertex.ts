import * as ti from '../taichi';
import { error } from '../utils/Logging';

export enum VertexAttrib {
    None = 0,
    Position = 1 << 0,
    Normal = 1 << 1,
    Tangent = 1 << 2,
    TexCoords0 = 1 << 3,
    TexCoords1 = 1 << 4,
    Color = 1 << 5,
    Joints = 1 << 6,
    Weights = 1 << 7,

    Max = 1 + (1 << 7),
    All = ~(~0 << 7),
}

export class VertexAttribSet {
    constructor(public val: number) {}
    test(attrib: VertexAttrib): boolean {
        return (this.val & (attrib as number)) != 0;
    }
    set(attrib: VertexAttrib) {
        this.val |= attrib as number;
    }
    foreach(f: (attrib: VertexAttrib) => any) {
        let curr = 1;
        while (curr < VertexAttrib.Max) {
            if (this.test(curr)) {
                f(curr);
            }
            curr = curr << 1;
        }
    }
}

export function getVertexAttribNumComponents(attrib: VertexAttrib) {
    switch (attrib) {
        case VertexAttrib.TexCoords0:
            return 2;
        case VertexAttrib.TexCoords1:
            return 2;
        case VertexAttrib.Position:
            return 3;
        case VertexAttrib.Normal:
            return 3;
        case VertexAttrib.Tangent:
            return 4;
        case VertexAttrib.Color:
            return 4;
        case VertexAttrib.Joints:
            return 4;
        case VertexAttrib.Weights:
            return 4;
        default:
            error('getVertexAttribNumComponents called on None or All ', attrib);
            return -1;
    }
}

export function getVertexAttribSetKernelType(attribs: VertexAttribSet) {
    let typeObj: any = {};
    attribs.foreach((attr: VertexAttrib) => {
        let numComponents = getVertexAttribNumComponents(attr);
        let vecType = ti.types.vector(ti.f32, numComponents);
        switch (attr) {
            case VertexAttrib.Position:
                typeObj['position'] = vecType;
                break;
            case VertexAttrib.Normal:
                typeObj['normal'] = vecType;
                break;
            case VertexAttrib.Tangent:
                typeObj['tangent'] = vecType;
                break;
            case VertexAttrib.TexCoords0:
                typeObj['texCoords0'] = vecType;
                break;
            case VertexAttrib.TexCoords1:
                typeObj['texCoords1'] = vecType;
                break;
            case VertexAttrib.Color:
                typeObj['color'] = vecType;
                break;
            case VertexAttrib.Joints:
                typeObj['joints'] = ti.types.vector(ti.i32, numComponents);
                break;
            case VertexAttrib.Weights:
                typeObj['weights'] = vecType;
                break;
            default:
                error('vert attr is None or All');
        }
    });
    return ti.types.struct(typeObj);
}

export class Vertex {
    constructor(public attribs: VertexAttribSet) {
        attribs.foreach((attr) => {
            this.ensureAttrib(attr);
        });
    }
    setAttribValue(attrib: VertexAttrib, value: number[]) {
        switch (attrib) {
            case VertexAttrib.Position: {
                this.position = value;
                break;
            }
            case VertexAttrib.Normal: {
                this.normal = value;
                break;
            }
            case VertexAttrib.Tangent: {
                this.tangent = value;
                break;
            }
            case VertexAttrib.TexCoords0: {
                this.texCoords0 = value;
                break;
            }
            case VertexAttrib.TexCoords1: {
                this.texCoords1 = value;
                break;
            }
            case VertexAttrib.Color: {
                this.color = value;
                break;
            }
            case VertexAttrib.Joints: {
                this.joints = value;
                break;
            }
            case VertexAttrib.Weights: {
                this.weights = value;
                break;
            }
            default:
                error('setAttribValue called on None or All');
        }
    }
    ensureAttrib(attrib: VertexAttrib) {
        let numComponents = getVertexAttribNumComponents(attrib);
        let zeros = Array(numComponents).fill(0);
        this.setAttribValue(attrib, zeros);
    }
    ensureAttribs(attribs: VertexAttribSet) {
        attribs.foreach((attr) => this.ensureAttrib(attr));
    }
    position: number[] | null = null;
    normal: number[] | null = null;
    tangent: number[] | null = null;
    texCoords0: number[] | null = null;
    texCoords1: number[] | null = null;
    color: number[] | null = null;
    joints: number[] | null = null;
    weights: number[] | null = null;
}
