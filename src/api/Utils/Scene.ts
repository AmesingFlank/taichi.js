import * as ti from "../../taichi"
import { Field } from "../../data/Field";
import { Material } from "./Material";
import { getVertexAttribSetKernelType, Vertex, VertexAttrib, VertexAttribSet } from "./Vertex";
import { SceneNode } from "./SceneNode";
import { Mesh } from "./Mesh";
import { DrawInfo, drawInfoKernelType } from "./DrawInfo";
import { Transform } from "./Transform";
import { InstanceInfo } from "./InstanceInfo";

export interface SceneData {
    vertexBuffer: Field, // Field of Vertex
    indexBuffer: Field,  // Field of int
    drawInfoBuffers: Field[]
    drawInstanceInfoBuffers: Field[]
    materialInfoBuffer: Field, // Field of MaterialInfo 
    nodesBuffer:Field,

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
    materialDrawInstanceInfos: InstanceInfo[][] = []

    vertexAttribSet: VertexAttribSet = new VertexAttribSet(VertexAttrib.None)

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(getVertexAttribSetKernelType(this.vertexAttribSet), this.vertices.length)
        await vertexBuffer.fromArray(this.vertices)

        let indexBuffer = ti.field(ti.i32, this.indices.length)
        await indexBuffer.fromArray(this.indices)

        let materialInfoBuffer = ti.field(new Material(0).getInfoType(), this.materials.length)
        let infosHost = this.materials.map(mat => mat.getInfo())
        await materialInfoBuffer.fromArray(infosHost)

        let drawInfoBuffers:Field[] = []
        for(let drawInfos of this.materialDrawInfos){
            let buffer = ti.field(drawInfoKernelType, drawInfos.length)
            await buffer.fromArray(drawInfos)
            drawInfoBuffers.push(buffer)
        }

        let drawInstanceInfoBuffers: Field[] = []
        for(let drawInstanceInfos of this.materialDrawInstanceInfos){
            let buffer = ti.field(InstanceInfo.getKernelType(), drawInstanceInfos.length)
            await buffer.fromArray(drawInstanceInfos)
            drawInstanceInfoBuffers.push(buffer)
        }

        let nodesBuffer: Field = ti.field(SceneNode.getKernelType(), this.nodes.length)
        await nodesBuffer.fromArray(this.nodes)

        let materials = this.materials.slice() 
        let drawInfos = this.materialDrawInfos.slice()
        return {
            vertexBuffer,
            indexBuffer,
            drawInfoBuffers,
            drawInstanceInfoBuffers,
            materialInfoBuffer,
            nodesBuffer,

            materials, 
            drawInfos
        }
    }

    computeDrawInfo() {
        this.materialDrawInfos = []
        this.materialDrawInstanceInfos = []
        for (let i = 0; i < this.materials.length; ++i) {
            let thisMaterialDrawInfo: DrawInfo[] = []
            let thisInstanceInfo: InstanceInfo[] = []
            let nextInstanceId = 0;
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
                                nextInstanceId++
                            )
                            thisMaterialDrawInfo.push(drawInfo)
                            let instanceInfo = new InstanceInfo(nodeIndex)
                            thisInstanceInfo.push(instanceInfo)
                        }
                    }
                }
            }
            this.materialDrawInfos.push(thisMaterialDrawInfo)
            this.materialDrawInstanceInfos.push(thisInstanceInfo)
        } 
    }

    computeGlobalTransforms(){
        let visit = (nodeIndex:number, parentGlobalTransform:Transform) => {
            let node = this.nodes[nodeIndex]
            node.globalTransform = parentGlobalTransform.mul(node.localTransform)
            for(let child of node.children){
                visit(child, node.globalTransform)
            }
        }
        for(let rootIndex of this.rootNodes){
            visit(rootIndex, new Transform)
        }
    }
}