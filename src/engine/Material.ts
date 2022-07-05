import { TextureBase } from "../data/Texture"
import { Type } from "../language/frontend/Type"
import * as ti from "../taichi"

export class MaterialAttribute {
    constructor(
        public numComponents: number,
        public value: number[],
        public texture: TextureBase | undefined = undefined,
        public texcoordsSet: number = 0
    ) {

    }

    getInfo(): MaterialAttributeInfo {
        return {
            value: this.value,
            hasTexture: this.texture !== undefined ? 1 : 0,
        }
    }

    getInfoKernelType(): Type {
        let valueType = ti.types.vector(ti.f32, this.numComponents)
        return ti.types.struct({
            value: valueType,
            hasTexture: ti.i32
        })
    }
}

export class Material {
    constructor(public materialID: number) {

    }

    name: string = ""
    baseColor: MaterialAttribute = new MaterialAttribute(4, [1, 1, 1, 1])
    metallicRoughness: MaterialAttribute = new MaterialAttribute(2, [0, 0])
    emissive: MaterialAttribute = new MaterialAttribute(3, [0, 0, 0])
    normalMap: MaterialAttribute = new MaterialAttribute(3, [0.5, 0.5, 1.0])

    getInfo(): MaterialInfo {
        return {
            materialID: this.materialID,
            baseColor: this.baseColor.getInfo(),
            metallicRoughness: this.metallicRoughness.getInfo(),
            emissive: this.emissive.getInfo(),
            normalMap: this.normalMap.getInfo()
        }
    }

    getInfoKernelType(): Type {
        return ti.types.struct({
            materialID: ti.i32,
            baseColor: this.baseColor.getInfoKernelType(),
            metallicRoughness: this.metallicRoughness.getInfoKernelType(),
            emissive: this.emissive.getInfoKernelType(),
            normalMap: this.normalMap.getInfoKernelType(),
        })
    }

    hasTexture(): boolean {
        return this.baseColor.texture !== undefined
    }
}


export interface MaterialAttributeInfo {
    value: number | number[]
    hasTexture: number // 1 or 0, representing true or false
}

// used by shaders
export interface MaterialInfo {
    materialID: number
    baseColor: MaterialAttributeInfo,
    metallicRoughness: MaterialAttributeInfo,
    emissive: MaterialAttributeInfo,
    normalMap: MaterialAttributeInfo
    // other stuff
}

