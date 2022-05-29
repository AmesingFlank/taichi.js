/// <reference types="dist" />
import { NativeTaichiAny } from "../native/taichi/GetTaichi";
export declare enum TextureDimensionality {
    Dim2d = 0,
    Dim3d = 1,
    DimCube = 2
}
export declare function toNativeImageDimensionality(dim: TextureDimensionality): NativeTaichiAny;
export declare function getTextureCoordsNumComponents(dim: TextureDimensionality): number;
export declare abstract class TextureBase {
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
export declare enum WrapMode {
    Repeat = "repeat",
    ClampToEdge = "clamp-to-edge",
    MirrorRepeat = "mirror-repeat"
}
export interface TextureSamplingOptions {
    wrapModeU?: WrapMode;
    wrapModeV?: WrapMode;
    wrapModeW?: WrapMode;
}
export declare class Texture extends TextureBase {
    numComponents: number;
    dimensions: number[];
    samplingOptions: TextureSamplingOptions;
    constructor(numComponents: number, dimensions: number[], sampleCount: number, samplingOptions: TextureSamplingOptions);
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
export declare class CanvasTexture extends TextureBase {
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
export declare class DepthTexture extends TextureBase {
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
export declare function isTexture(x: any): boolean;
