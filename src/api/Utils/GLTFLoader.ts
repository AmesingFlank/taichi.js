import { Vertex, VertexAttrib } from "./Vertex";
import { Scene } from "./Scene"
import { Material } from "./Material";
import { Texture } from "../../data/Texture";

import { parse, load } from '@loaders.gl/core';
import { GLTFLoader, GLBLoader } from '@loaders.gl/gltf';
import { endWith } from "../../utils/Utils";
import { Mesh, MeshPrimitive } from "./Mesh";
import { assert, error } from "../../utils/Logging";
import { SceneNode } from "./SceneNode";
import { matmul } from "../math";


export class GltfLoader {
    static async loadFromURL(url: string): Promise<Scene> {
        let resultScene = new Scene()
        const gltf = await load(url, endWith(url, ".gltf") ? GLTFLoader : GLBLoader);
        console.log(gltf)
        let buffers: Buffer[] = []
        for (let chunk of gltf.binChunks) {
            buffers.push(chunk.arrayBuffer)
        }

        let bufferViews: BufferView[] = []
        for (let view of gltf.json.bufferViews) {
            bufferViews.push(new BufferView(
                buffers[view.buffer],
                view.byteOffset,
                view.byteLength,
                view.byteStride ? view.byteStride : null
            ))
        }

        let accessors: Accessor[] = []
        for (let acc of gltf.json.accessors) {
            accessors.push(new Accessor(
                bufferViews[acc.bufferView],
                acc.byteOffset,
                acc.count,
                acc.componentType,
                acc.type,
                acc.max,
                acc.min
            ))
        }

        for (let i = 0; i < gltf.json.materials.length; ++i) {
            let inputMaterial = gltf.json.materials[i]
            let resultMaterial = new Material(i);
            let pbr = inputMaterial.pbrMetallicRoughness
            if (pbr.baseColorFactor) {
                resultMaterial.baseColor.value = pbr.baseColorFactor
            }
            resultScene.materials.push(resultMaterial)
        }

        for (let i = 0; i < gltf.json.meshes.length; ++i) {
            let inputMesh = gltf.json.meshes[i]
            let resultMesh = new Mesh()
            for (let prim of inputMesh.primitives) {
                if (prim.mode != 4) {
                    error("only supports triangle primitives in gltf")
                }
                let attrNames = Object.keys(prim.attributes)
                for (let name of attrNames) {
                    let attrib = getVeritexAttribFromGltfName(name)
                    resultScene.vertexAttribSet.set(attrib)
                }
                let thisPrimVertices: Vertex[] = []

                let acc0: Accessor = accessors[prim.attributes[attrNames[0]]]
                assert(Array.isArray(acc0.at(0)), "vertex attrib must be a vector", acc0.at(0), prim)
                let attrib0 = getVeritexAttribFromGltfName(attrNames[0])
                for (let j = 0; j < acc0.count; ++j) {
                    let vertex = new Vertex(resultScene.vertexAttribSet)
                    let value = acc0.at(j) as number[]
                    vertex.setAttribValue(attrib0, value)
                    thisPrimVertices.push(vertex)
                }

                for (let name of attrNames) {
                    if (name === attrNames[0]) {
                        continue
                    }
                    let acc: Accessor = accessors[prim.attributes[name]]
                    assert(Array.isArray(acc.at(0)), "vertex attrib must be a vector")
                    let attrib = getVeritexAttribFromGltfName(name)
                    assert(acc.count === thisPrimVertices.length, "accessor size mismatch")
                    for (let j = 0; j < acc.count; ++j) {
                        let value = acc.at(j) as number[]
                        thisPrimVertices[j].setAttribValue(attrib, value)
                    }
                }

                let baseVertex = resultScene.vertices.length
                resultScene.vertices = resultScene.vertices.concat(thisPrimVertices)
                let indices: number[] = []
                if (prim.indices === undefined) {
                    for (let i = 0; i < thisPrimVertices.length; ++i) {
                        indices.push(i + baseVertex)
                    }
                }
                else {
                    let indicesAcc = accessors[prim.indices]
                    assert(typeof (indicesAcc.at(0)) === "number", "indices must be number")
                    for (let i = 0; i < indicesAcc.count; ++i) {
                        indices.push(indicesAcc.at(i) as number + baseVertex)
                    }
                }

                let baseIndex = resultScene.indices.length
                resultScene.indices = resultScene.indices.concat(indices)

                let indexCount = indices.length
                let materialId = 0
                if (prim.material !== undefined) {
                    materialId = prim.material
                }

                let resultPrim = new MeshPrimitive(baseIndex, indexCount, materialId)
                resultMesh.primitives.push(resultPrim)
            }
            resultScene.meshes.push(resultMesh)
        }

        for (let i = 0; i < gltf.json.nodes.length; ++i) {
            resultScene.nodes.push(new SceneNode)
        }
        for (let i = 0; i < gltf.json.nodes.length; ++i) {
            let inputNode = gltf.json.nodes[i]
            let resultNode = resultScene.nodes[i]
            resultNode.mesh = inputNode.mesh
            if (inputNode.children) {
                for (let child of inputNode.children) {
                    resultNode.children.push(child)
                    resultScene.nodes[child].parent = i
                }
            }
            if (inputNode.matrix) {
                let m = inputNode.matrix
                resultNode.localTransform.matrix = [
                    [m[0], m[4], m[8], m[12]],
                    [m[1], m[5], m[9], m[13]],
                    [m[2], m[6], m[10], m[14]],
                    [m[3], m[7], m[11], m[15]],
                ]
            }
            else {
                let translation = getIdentity()
                if (inputNode.translation) {
                    translation[0][3] = inputNode.translation[0]
                    translation[1][3] = inputNode.translation[1]
                    translation[2][3] = inputNode.translation[2]
                }
                let rotation = getIdentity()
                if (inputNode.rotation) {
                    rotation = quatToMatrix(inputNode.rotation)
                }
                let scale = getIdentity()
                if (inputNode.scale) {
                    translation[0][0] = inputNode.scale[0]
                    translation[1][1] = inputNode.scale[1]
                    translation[2][2] = inputNode.scale[2]
                }
                resultNode.localTransform.matrix = matmul(translation, matmul(rotation, scale)) as number[][]
            }
        }
        for (let i = 0; i < resultScene.nodes.length; ++i) {
            if (resultScene.nodes[i].parent == -1) {
                resultScene.rootNodes.push(i)
            }
        }

        resultScene.computeDrawBatches()
        resultScene.computeGlobalTransforms()
        return resultScene
    }
}

class Buffer {
    constructor(
        public arrayBuffer: ArrayBuffer
    ) {

    }
}

class BufferView {
    constructor(
        public buffer: Buffer,
        public byteOffset: number,
        public byteLength: number,
        public byteStride: number | null = null
    ) {

    }
}

enum ComponentType {
    SignedByte = 5120,
    UnsignedByte = 5121,
    SignedShort = 5122,
    UnsignedShort = 5123,
    SignedInt = 5124,
    UnsignedInt = 5125,
    Float = 5126
}

function getComponentTypeNumBytes(componentType: ComponentType): number {
    switch (componentType) {
        case ComponentType.SignedByte: return 1
        case ComponentType.UnsignedByte: return 1
        case ComponentType.SignedShort: return 2
        case ComponentType.UnsignedShort: return 2
        case ComponentType.SignedInt: return 4
        case ComponentType.UnsignedInt: return 4
        case ComponentType.Float: return 4
    }
}

function getComponentTypeJavascriptBufferType(componentType: ComponentType): any {
    switch (componentType) {
        case ComponentType.SignedByte: return Int8Array
        case ComponentType.UnsignedByte: return Uint8Array
        case ComponentType.SignedShort: return Int16Array
        case ComponentType.UnsignedShort: return Uint16Array
        case ComponentType.SignedInt: return Int32Array
        case ComponentType.UnsignedInt: return Uint32Array
        case ComponentType.Float: return Float32Array
    }
}

function getTypeNumComponents(type: string): number {
    switch (type) {
        case "SCALAR": return 1
        case "VEC2": return 2
        case "VEC3": return 3
        case "VEC4": return 4
        default:
            error(`unreognized type: ${type}`)
            return -1
    }
}

class Accessor {
    constructor(
        public bufferView: BufferView,
        public byteOffset: number,
        public count: number,
        public componentType: ComponentType,
        public type: string,
        public max: number | number[],
        public min: number | number[]
    ) {
        let bufferConstructor = getComponentTypeJavascriptBufferType(componentType)
        this.componentBufferView = new bufferConstructor(bufferView.buffer)

        this.componentNumBytes = getComponentTypeNumBytes(componentType)
        this.numComponents = getTypeNumComponents(type)

        let totalByteOffset = byteOffset + bufferView.byteOffset
        this.componentOffset = totalByteOffset / this.componentNumBytes

        let byteStride = this.numComponents * this.componentNumBytes
        if (bufferView.byteStride !== null) {
            byteStride = bufferView.byteStride
        }
        this.componentStride = byteStride / this.componentNumBytes
    }

    componentBufferView: any
    componentNumBytes: number
    numComponents: number

    componentOffset: number
    componentStride: number

    at(index: number): number | number[] {
        let componentIndex = this.componentOffset + index * this.componentStride
        if (this.numComponents === 1) {
            return this.componentBufferView[componentIndex]
        }
        else {
            return Array.from(this.componentBufferView.slice(componentIndex, componentIndex + this.numComponents))
        }
    }
}

function getVeritexAttribFromGltfName(name: string): VertexAttrib {
    switch (name) {
        case "POSITION": return VertexAttrib.Position
        case "NORMAL": return VertexAttrib.Normal
        case "TEXCOORDS_0": return VertexAttrib.TexCoords
        case "COLOR_0": return VertexAttrib.Color
        case "TANGENT": return VertexAttrib.Tangent
        default:
            error("unsupported vertex attr name")
            return VertexAttrib.None
    }
}

function getIdentity(): number[][] {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
    ]
}

function quatToMatrix(q: number[]): number[][] {
    let m = getIdentity()
    let sqw = q[3] * q[3];
    let sqx = q[0] * q[0];
    let sqy = q[1] * q[1];
    let sqz = q[2] * q[2];

    // invs (inverse square length) is only required if quaternion is not already normalised
    let invs = 1 / (sqx + sqy + sqz + sqw)
    m[0][0] = (sqx - sqy - sqz + sqw) * invs; // since sqw + sqx + sqy + sqz =1/invs*invs
    m[1][1] = (-sqx + sqy - sqz + sqw) * invs;
    m[2][2] = (-sqx - sqy + sqz + sqw) * invs;

    let tmp1 = q[0] * q[1];
    let tmp2 = q[2] * q[3];
    m[1][0] = 2.0 * (tmp1 + tmp2) * invs;
    m[0][1] = 2.0 * (tmp1 - tmp2) * invs;

    tmp1 = q[0] * q[2];
    tmp2 = q[1] * q[3];
    m[2][0] = 2.0 * (tmp1 - tmp2) * invs;
    m[0][2] = 2.0 * (tmp1 + tmp2) * invs;
    tmp1 = q[1] * q[2];
    tmp2 = q[0] * q[3];
    m[2][1] = 2.0 * (tmp1 + tmp2) * invs;
    m[1][2] = 2.0 * (tmp1 - tmp2) * invs;
    return m
}
