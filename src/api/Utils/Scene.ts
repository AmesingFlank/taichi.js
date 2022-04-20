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

    getKernelData(): SceneData {
        let vertexBuffer = ti.field(vertexType, this.vertices.length)
        vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        indexBuffer.fromArray(this.indices)

        let materialInfos = ti.field(new Material(0).getInfoType(), this.materials.length)
        materialInfos.fromArray(this.materials.map(mat => mat.getInfo()))

        let materials = this.materials.slice()

        return {
            vertexBuffer,
            indexBuffer,
            materialInfos,
            materials
        }
    }
}