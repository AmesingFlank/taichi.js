import * as ti from "../../taichi"
import { Field } from "../../data/Field";
import { Material } from "./Material";
import { Vertex, vertexType } from "./Vertex";

export interface SceneData {
    vertexBuffer: Field, // Field of Vertex
    indexBuffer: Field,  // Field of int
    materialInfos: Field, // Field of MaterialInfo
    materials: Material[]
}

export class Scene {
    constructor(){

    }

    vertices: Vertex[] = []
    indices: number[] = []
    materials: Material[] = []

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(vertexType, this.vertices.length)
        await vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        await indexBuffer.fromArray(this.indices)

        let materialInfos = ti.field(new Material(0).getInfoType(), this.materials.length)
        let infosHost = this.materials.map(mat => mat.getInfo())
        console.log(infosHost)
        await materialInfos.fromArray(infosHost)

        let materials = this.materials.slice()

        return {
            vertexBuffer,
            indexBuffer,
            materialInfos,
            materials
        }
    }
}