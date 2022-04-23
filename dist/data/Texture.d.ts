/// <reference types="dist" />
import { NativeTaichiAny } from "../native/taichi/GetTaichi";
declare enum TextureDimensionality {
    Dim2d = 0,
    DimCube = 1
}
declare function toNativeImageDimensionality(dim: TextureDimensionality): NativeTaichiAny;
declare function getTextureCoordsNumComponents(dim: TextureDimensionality): number;
declare abstract class TextureBase {
    abstract getGPUTextureFormat(): GPUTextureFormat;
    abstract canUseAsRengerTarget(): boolean;
    abstract getGPUTexture(): GPUTexture;
    abstract getGPUTextureView(): GPUTextureView;
    abstract getGPUSampler(): GPUSampler;
    abstract getTextureDimensionality(): TextureDimensionality;
    textureId: number;
    nativeTexture: NativeTaichiAny;
}
declare class Texture extends TextureBase {
    numComponents: number;
    dimensions: number[];
    constructor(numComponents: number, dimensions: number[]);
    private texture;
    private textureView;
    private sampler;
    getGPUTextureFormat(): GPUTextureFormat;
    canUseAsRengerTarget(): boolean;
    getGPUTexture(): GPUTexture;
    getGPUTextureView(): GPUTextureView;
    getGPUSampler(): GPUSampler;
    getTextureDimensionality(): TextureDimensionality;
    static createFromURL(url: string): Promise<Texture>;
}
declare class CanvasTexture extends TextureBase {
    htmlCanvas: HTMLCanvasElement;
    constructor(htmlCanvas: HTMLCanvasElement);
    context: GPUCanvasContext;
    format: GPUTextureFormat;
    private sampler;
    getGPUTextureFormat(): GPUTextureFormat;
    canUseAsRengerTarget(): boolean;
    getGPUTexture(): GPUTexture;
    getGPUTextureView(): GPUTextureView;
    getGPUSampler(): GPUSampler;
    getTextureDimensionality(): TextureDimensionality;
}
declare class DepthTexture extends TextureBase {
    dimensions: number[];
    constructor(dimensions: number[]);
    private texture;
    private textureView;
    private sampler;
    getGPUTextureFormat(): GPUTextureFormat;
    canUseAsRengerTarget(): boolean;
    getGPUTexture(): GPUTexture;
    getTextureDimensionality(): TextureDimensionality;
    getGPUTextureView(): GPUTextureView;
    getGPUSampler(): GPUSampler;
}
export declare class CubeTexture extends TextureBase {
    dimensions: number[];
    constructor(dimensions: number[]);
    private texture;
    private textureView;
    private sampler;
    getGPUTextureFormat(): GPUTextureFormat;
    canUseAsRengerTarget(): boolean;
    getGPUTexture(): GPUTexture;
    getTextureDimensionality(): TextureDimensionality;
    getGPUTextureView(): GPUTextureView;
    getGPUSampler(): GPUSampler;
    static createFromURL(urls: string[]): Promise<CubeTexture>;
}
declare function isTexture(x: any): boolean;
export { TextureBase, Texture, CanvasTexture, DepthTexture, isTexture, TextureDimensionality, getTextureCoordsNumComponents, toNativeImageDimensionality };
