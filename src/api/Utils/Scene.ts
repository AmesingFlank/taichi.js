import * as ti from "../../taichi"
import { Field } from "../../data/Field";
import { Material } from "./Material";
import { getVertexAttribSetKernelType, Vertex, VertexAttrib, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo, drawInfoKernelType } from "./DrawInfo";
import { Transform } from "./Transform";
import { InstanceInfo } from "./InstanceInfo";
import { BatchInfo } from "./BatchInfo";

export interface SceneData {
    vertexBuffer: Field, // Field of Vertex
    indexBuffer: Field,  // Field of int

    batchesDrawInfoBuffers: Field[],
    batchesDrawInstanceInfoBuffers: Field[],

    materialInfoBuffer: Field, // Field of MaterialInfo 
    nodesBuffer: Field,
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

    batchInfos: BatchInfo[] = []
    batchesDrawInfos: DrawInfo[][] = []
    batchesDrawInstanceInfos: InstanceInfo[][] = []

    vertexAttribSet: VertexAttribSet = new VertexAttribSet(VertexAttrib.None) 

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(getVertexAttribSetKernelType(this.vertexAttribSet), this.vertices.length)
        await vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        await indexBuffer.fromArray(this.indices)

        let materialInfoBuffer = ti.field(new Material(0).getInfoType(), this.materials.length)
        let infosHost = this.materials.map(mat => mat.getInfo())
        await materialInfoBuffer.fromArray(infosHost)

        let batchesDrawInfoBuffers: Field[] = []
        for (let drawInfos of this.batchesDrawInfos) {
            let buffer = ti.field(drawInfoKernelType, drawInfos.length)
            await buffer.fromArray(drawInfos)
            batchesDrawInfoBuffers.push(buffer)
        }

        let batchesDrawInstanceInfoBuffers: Field[] = []
        for (let drawInstanceInfos of this.batchesDrawInstanceInfos) {
            let buffer = ti.field(InstanceInfo.getKernelType(), drawInstanceInfos.length)
            await buffer.fromArray(drawInstanceInfos)
            batchesDrawInstanceInfoBuffers.push(buffer)
        }

        let nodesBuffer: Field = ti.field(SceneNode.getKernelType(), this.nodes.length)
        await nodesBuffer.fromArray(this.nodes)

        return {
            vertexBuffer,
            indexBuffer,
            batchesDrawInfoBuffers,
            batchesDrawInstanceInfoBuffers,
            materialInfoBuffer,
            nodesBuffer,
        }
    }

    init() {
        this.computeDrawBatches()
        this.computeGlobalTransforms() 
    } 

    computeDrawBatches() {
        this.batchesDrawInfos = []
        this.batchesDrawInstanceInfos = []

        let textureFreeBatchDrawInfo: DrawInfo[] = []
        let textureFreeBatchInstanceInfo: InstanceInfo[] = []

        for (let i = 0; i < this.materials.length; ++i) {
            let material = this.materials[i]
            let thisMaterialDrawInfo: DrawInfo[] = []
            let thisMaterialInstanceInfo: InstanceInfo[] = []
            for (let nodeIndex = 0; nodeIndex < this.nodes.length; ++nodeIndex) {
                let node = this.nodes[nodeIndex]
                if (node.mesh >= 0) {
                    let mesh = this.meshes[node.mesh]
                    for (let prim of mesh.primitives) {
                        if (prim.materialID === i) {
                            let drawInfo = new DrawInfo(
                                prim.indexCount,
                                1,
                                prim.firstIndex,
                                0,
                                -1 // firstInstance, we'll fill this later
                            )
                            thisMaterialDrawInfo.push(drawInfo)
                            let instanceInfo = new InstanceInfo(nodeIndex, i)
                            thisMaterialInstanceInfo.push(instanceInfo)
                        }
                    }
                }
            }
            if (material.hasTexture()) {
                this.batchesDrawInfos.push(thisMaterialDrawInfo)
                this.batchesDrawInstanceInfos.push(thisMaterialInstanceInfo)
                this.batchInfos.push(new BatchInfo(i))
            }
            else {
                textureFreeBatchDrawInfo = textureFreeBatchDrawInfo.concat(thisMaterialDrawInfo)
                textureFreeBatchInstanceInfo = textureFreeBatchInstanceInfo.concat(thisMaterialInstanceInfo)
            }
        }
        if (textureFreeBatchDrawInfo.length > 0 && textureFreeBatchInstanceInfo.length > 0) {
            this.batchesDrawInfos.push(textureFreeBatchDrawInfo)
            this.batchesDrawInstanceInfos.push(textureFreeBatchInstanceInfo)
            this.batchInfos.push(new BatchInfo(-1)) // -1 stands for "this batch contains more than one (texture-free) materials"
        }
        for (let batch of this.batchesDrawInfos) {
            for (let i = 0; i < batch.length; ++i) {
                batch[i].firstInstance = i
            }
        }
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