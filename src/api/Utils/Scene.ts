import * as ti from "../../taichi"
import { Field } from "../../data/Field";
import { Material } from "./Material";
import { getVertexAttribSetKernelType, Vertex, VertexAttrib, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo, drawInfoKernelType } from "./DrawInfo";

export interface SceneData {
    vertexBuffer: Field, // Field of Vertex
    indexBuffer: Field,  // Field of int
    drawInfoBuffers: Field[]
    materialInfosBuffer: Field, // Field of MaterialInfo
    materials: Material[]
    drawInfos: DrawInfo[][]
}

export class Scene {
    constructor() {

    }

    vertices: Vertex[] = []
    indices: number[] = []
    materials: Material[] = []
    nodes: SceneNode[] = []
    rootNodes: number[] = []
    meshes: Mesh[] = []
    materialDrawInfos: DrawInfo[][] = []

    vertexAttribSet: VertexAttribSet = new VertexAttribSet(VertexAttrib.None)

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(getVertexAttribSetKernelType(this.vertexAttribSet), this.vertices.length)
        await vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        await indexBuffer.fromArray(this.indices)

        let materialInfosBuffer = ti.field(new Material(0).getInfoType(), this.materials.length)
        let infosHost = this.materials.map(mat => mat.getInfo())
        await materialInfosBuffer.fromArray(infosHost)

        let drawInfoBuffers:Field[] = []
        for(let drawInfos of this.materialDrawInfos){
            let buffer = ti.field(drawInfoKernelType, drawInfos.length)
            await buffer.fromArray(drawInfos)
            drawInfoBuffers.push(buffer)
        }

        let materials = this.materials.slice() 
        let drawInfos = this.materialDrawInfos.slice()
        return {
            vertexBuffer,
            indexBuffer,
            drawInfoBuffers,
            materialInfosBuffer,
            materials, 
            drawInfos
        }
    }

    computeDrawInfo() {
        this.materialDrawInfos = []
        for (let i = 0; i < this.materials.length; ++i) {
            let thisMaterialDrawInfo: DrawInfo[] = []
            let nextInstanceId = 0;
            for (let node of this.nodes) {
                if (node.mesh >= 0) {
                    let mesh = this.meshes[node.mesh]
                    for (let prim of mesh.primitives) {
                        if (prim.materialID === i) {
                            let drawInfo = new DrawInfo(
                                prim.indexCount,
                                1,
                                prim.firstIndex,
                                0,
                                nextInstanceId++
                            )
                            thisMaterialDrawInfo.push(drawInfo)
                        }
                    }
                }
            }
            this.materialDrawInfos.push(thisMaterialDrawInfo)
        }
        return this.materialDrawInfos
    }
}