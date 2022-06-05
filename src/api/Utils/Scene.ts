import * as ti from "../../taichi"
import { Field } from "../../data/Field";
import { Material } from "./Material";
import { getVertexAttribSetKernelType, Vertex, VertexAttrib, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo } from "./DrawInfo";
import { Transform } from "./Transform";
import { InstanceInfo } from "./InstanceInfo";
import { BatchInfo } from "./BatchInfo";
import { LightInfo } from "./LightInfo";
import { HdrTexture } from "./HDRLoader";

export interface SceneData {
    vertexBuffer: Field, // Field of Vertex
    indexBuffer: Field,  // Field of int 

    materialInfoBuffer: Field, // Field of MaterialInfo 
    nodesBuffer: Field,

    lightsInfoBuffer: Field | undefined
}

export class Scene {
    constructor() {
        this.vertexAttribSet.set(VertexAttrib.Position)
        this.vertexAttribSet.set(VertexAttrib.Normal)
        this.vertexAttribSet.set(VertexAttrib.TexCoords)
    }

    vertices: Vertex[] = []
    indices: number[] = []
    materials: Material[] = []
    nodes: SceneNode[] = []
    rootNodes: number[] = []
    meshes: Mesh[] = []

    lights: LightInfo[] = []

    ibl: HdrTexture | undefined = undefined

    vertexAttribSet: VertexAttribSet = new VertexAttribSet(VertexAttrib.None)

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(getVertexAttribSetKernelType(this.vertexAttribSet), this.vertices.length)
        await vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        await indexBuffer.fromArray(this.indices)

        let materialInfoBuffer = ti.field(new Material(0).getInfoKernelType(), this.materials.length)
        let infosHost = this.materials.map(mat => mat.getInfo())
        await materialInfoBuffer.fromArray(infosHost)

        let nodesBuffer: Field = ti.field(SceneNode.getKernelType(), this.nodes.length)
        await nodesBuffer.fromArray(this.nodes)

        let lightsInfoBuffer: Field | undefined = undefined
        if (this.lights.length > 0) {
            lightsInfoBuffer = ti.field(LightInfo.getKernelType(), this.lights.length)
            await lightsInfoBuffer.fromArray(this.lights)
        }

        return {
            vertexBuffer,
            indexBuffer,
            materialInfoBuffer,
            nodesBuffer,
            lightsInfoBuffer
        }
    }

    init() {
        this.computeGlobalTransforms()
    }

    computeGlobalTransforms() {
        let visit = (nodeIndex: number, parentGlobalTransform: Transform) => {
            let node = this.nodes[nodeIndex]
            node.globalTransform = parentGlobalTransform.mul(node.localTransform)
            for (let child of node.children) {
                visit(child, node.globalTransform)
            }
        }
        for (let rootIndex of this.rootNodes) {
            visit(rootIndex, new Transform)
        }
    }
}