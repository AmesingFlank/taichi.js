import { Field } from '../data/Field';
import { CanvasTexture, CubeTexture, DepthTexture, Texture } from '../data/Texture';
import { PrimitiveType, Type } from "../frontend/Type";
declare function field(type: PrimitiveType | Type, dimensions: number[] | number): Field;
declare let Vector: {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number) => Field;
};
declare let Matrix: {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number) => Field;
};
declare let Struct: {
    field: (members: any, dimensions: number[] | number) => Field;
};
declare let texture: (numComponents: number, dimensions: number[], sampleCount?: number) => Texture;
declare let canvasTexture: (canvas: HTMLCanvasElement, sampleCount?: number) => CanvasTexture;
declare let depthTexture: (dimensions: number[], sampleCount?: number) => DepthTexture;
declare let createTextureFromURL: (url: string) => Promise<Texture>;
declare let createCubeTextureFromURL: (urls: string[]) => Promise<CubeTexture>;
export { field, Vector, Matrix, Struct, texture, canvasTexture, depthTexture, createTextureFromURL, createCubeTextureFromURL };
