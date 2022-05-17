/// <reference types="dist" />
import { NativeTaichiAny } from "../native/taichi/GetTaichi";
declare enum TextureDimensionality {
    Dim2d = 0,
    Dim3d = 1,
    DimCube = 2
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
    sampleCount: number;
}
declare class Texture extends TextureBase {
    numComponents: number;
    dimensions: number[];
    constructor(numComponents: number, dimensions: number[], sampleCount: number);
    private texture;
    private textureView;
    private sampler;
    getGPUTextureFormat(): GPUTextureFormat;
    canUseAsRengerTarget(): boolean;
    getGPUTexture(): GPUTexture;
    getGPUTextureView(): GPUTextureView;
    getGPUSampler(): GPUSampler;
    getTextureDimensionality(): TextureDimensionality;
    static createFromBitmap(bitmap: ImageBitmap): Promise<Texture>;
    static createFromHtmlImage(image: HTMLImageElement): Promise<Texture>;
    static createFromURL(url: string): Promise<Texture>;
}
declare class CanvasTexture extends TextureBase {
    htmlCanvas: HTMLCanvasElement;
    constructor(htmlCanvas: HTMLCanvasElement, sampleCount: number);
    renderTexture: GPUTexture | null;
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
    constructor(dimensions: number[], sampleCount: number);
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
    static createFromBitmap(bitmaps: ImageBitmap[]): Promise<CubeTexture>;
    static createFromHtmlImage(images: HTMLImageElement[]): Promise<CubeTexture>;
    static createFromURL(urls: string[]): Promise<CubeTexture>;
}
declare function isTexture(x: any): boolean;
export { TextureBase, Texture, CanvasTexture, DepthTexture, isTexture, TextureDimensionality, getTextureCoordsNumComponents, toNativeImageDimensionality };
