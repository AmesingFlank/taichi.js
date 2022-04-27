import { Vertex } from "./Vertex";
import { Scene } from "./Scene"
import { Material } from "./Material";
import { Texture } from "../../data/Texture";

import { parse, load } from '@loaders.gl/core';
import { GLTFLoader, GLBLoader } from '@loaders.gl/gltf';
import { endWith } from "../../utils/Utils";


export class GltfLoader {
    static async loadFromURL(url: string): Promise<Scene> {
        let resultScene = new Scene()
        const data = await load(url, endWith(url, ".gltf") ? GLTFLoader : GLBLoader);
        console.log(data)
        return resultScene
    }
}