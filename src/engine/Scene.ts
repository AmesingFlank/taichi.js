import * as ti from '../taichi';
import { Field } from '../data/Field';
import { Material } from './Material';
import { getVertexAttribSetKernelType, Vertex, VertexAttrib, VertexAttribSet } from './Vertex';
import { SceneNode } from './SceneNode';
import { Mesh } from './Mesh';
import { DrawInfo } from './common/DrawInfo';
import { Transform } from './Transform';
import { InstanceInfo } from './common/InstanceInfo';
import { BatchInfo } from './common/BatchInfo';
import { LightInfo } from './common/LightInfo';
import { HdrTexture } from './loaders/HDRLoader';
import { error } from '../utils/Logging';
import { GltfLoader } from './loaders/GLTFLoader';
import { ShadowInfo } from './common/ShadowInfo';

export interface SceneData {
    vertexBuffer: Field; // Field of Vertex
    indexBuffer: Field; // Field of int

    materialInfoBuffer: Field; // Field of MaterialInfo
    nodesBuffer: Field;

    lightsInfoBuffer: Field | undefined;
}

export class Scene {
    constructor() {
        this.vertexAttribSet.set(VertexAttrib.Position);
        this.vertexAttribSet.set(VertexAttrib.Normal);
        this.vertexAttribSet.set(VertexAttrib.TexCoords0);
        this.nodes = [new SceneNode()];
        this.rootNode = 0;
    }

    vertices: Vertex[] = [];
    indices: number[] = [];
    materials: Material[] = [];
    nodes: SceneNode[] = [];
    rootNode: number;
    meshes: Mesh[] = [];

    lights: LightInfo[] = [];

    ibl: HdrTexture | undefined = undefined;
    iblIntensity = 1.0;
    iblShadows: ShadowInfo[] = [];
    iblBackgroundBlur = 0.0;

    vertexAttribSet: VertexAttribSet = new VertexAttribSet(VertexAttrib.None);

    async getKernelData(): Promise<SceneData> {
        let vertexBuffer = ti.field(getVertexAttribSetKernelType(this.vertexAttribSet), this.vertices.length);
        await vertexBuffer.fromArray(this.vertices);

        let indexBuffer = ti.field(ti.i32, this.indices.length);
        await indexBuffer.fromArray(this.indices);

        let materialInfoBuffer = ti.field(new Material(0).getInfoKernelType(), this.materials.length);
        let infosHost = this.materials.map((mat) => mat.getInfo());
        await materialInfoBuffer.fromArray(infosHost);

        let nodesBuffer: Field = ti.field(SceneNode.getKernelType(), this.nodes.length);
        await nodesBuffer.fromArray(this.nodes);

        let lightsInfoBuffer: Field | undefined = undefined;
        if (this.lights.length > 0) {
            lightsInfoBuffer = ti.field(LightInfo.getKernelType(), this.lights.length);
            await lightsInfoBuffer.fromArray(this.lights);
        }

        return {
            vertexBuffer,
            indexBuffer,
            materialInfoBuffer,
            nodesBuffer,
            lightsInfoBuffer,
        };
    }

    init() {
        this.computeGlobalTransforms();
    }

    computeGlobalTransforms() {
        let visit = (nodeIndex: number, parentGlobalTransform: Transform) => {
            let node = this.nodes[nodeIndex];
            node.globalTransform = parentGlobalTransform.mul(node.localTransform);
            for (let child of node.children) {
                visit(child, node.globalTransform);
            }
        };
        visit(this.rootNode, new Transform());
    }

    async add(scene: Scene, transform: Transform = new Transform()) {
        let nodeOffset = this.nodes.length;
        this.nodes = this.nodes.concat(scene.nodes);

        let vertexOffset = this.vertices.length;
        this.vertices = this.vertices.concat(scene.vertices);

        let indexOffset = this.indices.length;
        for (let i = 0; i < scene.indices.length; ++i) {
            scene.indices[i] += vertexOffset;
        }
        this.indices = this.indices.concat(scene.indices);

        let materialOffset = this.materials.length;
        this.materials = this.materials.concat(scene.materials);

        let meshOffset = this.meshes.length;
        this.meshes = this.meshes.concat(scene.meshes);

        scene.nodes[scene.rootNode].localTransform = transform;
        scene.nodes[scene.rootNode].parent = this.rootNode;
        let sceneRootCurrentId = scene.rootNode + nodeOffset;
        this.nodes[this.rootNode].children.push(sceneRootCurrentId);

        for (let node of scene.nodes) {
            if (node.parent !== -1) {
                node.parent = node.parent + nodeOffset;
            }
            node.children = node.children.map((id) => id + nodeOffset);
            if (node.mesh !== -1) {
                node.mesh += meshOffset;
            }
        }

        for (let mat of scene.materials) {
            mat.materialID += materialOffset;
        }

        for (let mesh of scene.meshes) {
            for (let prim of mesh.primitives) {
                prim.firstIndex += indexOffset;
                prim.materialID += materialOffset;
            }
        }
        this.init();
        return sceneRootCurrentId;
    }

    async addGLTF(url: string, transform: Transform = new Transform()) {
        let gltf = await GltfLoader.loadFromURL(url);
        return await this.add(gltf, transform);
    }
}
