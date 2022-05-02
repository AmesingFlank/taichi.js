import * as ti from "../../taichi"
import { error } from "../../utils/Logging"

export enum VertexAttrib {
    None = 0,
    Position = 1 << 0,
    Normal = 1 << 1,
    Tangent = 1 << 2,
    TexCoords = 1 << 3,
    Color = 1 << 4,
    All = ~(~0 << 5)
};

export class VertexAttribSet {
    constructor(public val: number) {

    }
    test(attrib: VertexAttrib): boolean {
        return (this.val & (attrib as number)) != 0
    }
    set(attrib: VertexAttrib) {
        this.val |= attrib as number
    }
    foreach(f: (attrib: VertexAttrib) => any) {
        let curr = 1
        while (curr <= VertexAttrib.Color) {
            if (this.test(curr)) {
                f(curr)
            }
            curr = curr << 1
        }
    }
}

export function getVertexAttribNumComponents(attrib: VertexAttrib) {
    switch (attrib) {
        case VertexAttrib.Position: return 3
        case VertexAttrib.Normal: return 3
        case VertexAttrib.Tangent: return 4
        case VertexAttrib.TexCoords: return 2
        case VertexAttrib.Color: return 4
        default:
            error("getVertexAttribNumComponents called on None or All ", attrib)
            return -1
    }
}

export function getVertexAttribSetKernelType(attribs: VertexAttribSet) {
    let typeObj: any = {}
    attribs.foreach((attr: VertexAttrib) => {
        let numComponents = getVertexAttribNumComponents(attr)
        let vecType = ti.types.vector(ti.f32, numComponents)
        switch (attr) {
            case VertexAttrib.Position: typeObj["position"] = vecType; break
            case VertexAttrib.Normal: typeObj["normal"] = vecType; break
            case VertexAttrib.Tangent: typeObj["tangent"] = vecType; break
            case VertexAttrib.TexCoords: typeObj["texCoords"] = vecType; break
            case VertexAttrib.Color: typeObj["color"] = vecType; break
            default:
                error("vert attr is None or All")
        }
    })
    return ti.types.struct(typeObj)
}

export class Vertex {
    constructor(public attribs: VertexAttribSet) {
        attribs.foreach((attr) => {
            this.ensureAttrib(attr)
        })
    }
    setAttribValue(attrib: VertexAttrib, value: number[]) {
        switch (attrib) {
            case VertexAttrib.Position: {
                this.position = value
                break;
            }
            case VertexAttrib.Normal: {
                this.normal = value
                break;
            }
            case VertexAttrib.Tangent: {
                this.tangent = value
                break;
            }
            case VertexAttrib.TexCoords: {
                this.texCoords = value
                break;
            }
            case VertexAttrib.Color: {
                this.color = value
                break;
            }
            default:
                error("setAttribValue called on None or All")
        }
    }
    ensureAttrib(attrib: VertexAttrib) {
        let numComponents = getVertexAttribNumComponents(attrib)
        let zeros = Array(numComponents).fill(0)
        this.setAttribValue(attrib, zeros)
    }
    ensureAttribs(attribs: VertexAttribSet) {
        attribs.foreach((attr) => this.ensureAttrib(attr))
    }
    position: number[] | null = null
    normal: number[] | null = null
    tangent: number[] | null = null
    texCoords: number[] | null = null
    color: number[] | null = null
}