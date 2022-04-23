import { TextureBase } from "../../data/Texture"
import { Type } from "../../frontend/Type"
import * as ti from "../../taichi"

export class MaterialAttribute {
    constructor(
        public numComponents: number,
        public value: number | number[] | undefined = undefined,
        public texture: TextureBase | undefined = undefined
    ) {

    } 

    getInfo(): MaterialAttributeInfo {
        let defaultValue: number | number[] = 0.0
        if (this.numComponents > 1) {
            defaultValue = []
            for (let i = 0; i < this.numComponents; ++i) {
                defaultValue.push(0.0)
            }
        }
        return {
            hasValue: this.value !== undefined ? 1 : 0,
            value: this.value !== undefined ? this.value : defaultValue,
            hasTexture: this.texture !== undefined ? 1 : 0,
        }
    }

    getInfoType(): Type {
        let valueType = this.numComponents === 1 ? ti.f32 : ti.types.vector(ti.f32, this.numComponents)
        return ti.types.struct({
            hasValue: ti.i32,
            value: valueType,
            hasTexture: ti.i32
        })
    }
}

export class Material {
    constructor(public materialID: number) {

    }

    name: string = ""
    baseColor: MaterialAttribute = new MaterialAttribute(4)

    getInfo(): MaterialInfo {
        return {
            materialID: this.materialID,
            baseColor: this.baseColor.getInfo()
        }
    }

    getInfoType(): Type {
        return ti.types.struct({
            materialID: ti.i32,
            baseColor: this.baseColor.getInfoType()
        })
    }
}


export interface MaterialAttributeInfo {
    hasValue: number // 1 or 0, representing true or false
    value: number | number[]
    hasTexture: number // 1 or 0, representing true or false
}

// used by shaders
export interface MaterialInfo {
    materialID: number
    baseColor: MaterialAttributeInfo
    // other stuff
}

export const materialAttributeInfoType = ti.types.struct({
    position: ti.types.vector(ti.f32, 3),
    normal: ti.types.vector(ti.f32, 3),
    texCoords: ti.types.vector(ti.f32, 2),
    materialID: ti.i32
})


