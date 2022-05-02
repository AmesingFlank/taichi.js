import { TextureBase } from "../../data/Texture";
import { Type } from "../../frontend/Type";
export declare class MaterialAttribute {
    numComponents: number;
    value: number | number[] | undefined;
    texture: TextureBase | undefined;
    constructor(numComponents: number, value?: number | number[] | undefined, texture?: TextureBase | undefined);
    getInfo(): MaterialAttributeInfo;
    getInfoType(): Type;
}
export declare class Material {
    materialID: number;
    constructor(materialID: number);
    name: string;
    baseColor: MaterialAttribute;
    getInfo(): MaterialInfo;
    getInfoType(): Type;
    hasTexture(): boolean;
}
export interface MaterialAttributeInfo {
    hasValue: number;
    value: number | number[];
    hasTexture: number;
}
export interface MaterialInfo {
    materialID: number;
    baseColor: MaterialAttributeInfo;
}
export declare const materialAttributeInfoType: import("../../frontend/Type").StructType;
