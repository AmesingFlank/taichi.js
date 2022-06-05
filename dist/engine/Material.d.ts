import { TextureBase } from "../data/Texture";
import { Type } from "../frontend/Type";
export declare class MaterialAttribute {
    numComponents: number;
    value: number[];
    texture: TextureBase | undefined;
    constructor(numComponents: number, value: number[], texture?: TextureBase | undefined);
    getInfo(): MaterialAttributeInfo;
    getInfoKernelType(): Type;
}
export declare class Material {
    materialID: number;
    constructor(materialID: number);
    name: string;
    baseColor: MaterialAttribute;
    metallicRoughness: MaterialAttribute;
    emissive: MaterialAttribute;
    normalMap: MaterialAttribute;
    getInfo(): MaterialInfo;
    getInfoKernelType(): Type;
    hasTexture(): boolean;
}
export interface MaterialAttributeInfo {
    value: number | number[];
    hasTexture: number;
}
export interface MaterialInfo {
    materialID: number;
    baseColor: MaterialAttributeInfo;
    metallicRoughness: MaterialAttributeInfo;
    emissive: MaterialAttributeInfo;
    normalMap: MaterialAttributeInfo;
}
