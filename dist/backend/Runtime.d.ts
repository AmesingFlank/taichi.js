/// <reference types="dist" />
import { CompiledKernel, KernelParams, ResourceBinding } from './Kernel';
import { SNodeTree } from '../data/SNodeTree';
import { Field } from '../data/Field';
import { TextureBase, TextureDimensionality } from '../data/Texture';
declare class Runtime {
    adapter: GPUAdapter | null;
    device: GPUDevice | null;
    kernels: CompiledKernel[];
    materializedTrees: SNodeTree[];
    textures: TextureBase[];
    supportsIndirectFirstInstance: boolean;
    private globalTmpsBuffer;
    private randStatesBuffer;
    constructor();
    init(): Promise<void>;
    createDevice(): Promise<void>;
    createKernel(params: KernelParams): CompiledKernel;
    sync(): Promise<void>;
    launchKernel(kernel: CompiledKernel, ...args: any[]): Promise<any>;
    addArgsBuffer(size: number): GPUBuffer;
    addRetsBuffer(size: number): GPUBuffer;
    private createGlobalTmpsBuffer;
    private createRandStatesBuffer;
    getGPUBindGroupEntries(bindings: ResourceBinding[], argsBuffer: GPUBuffer | null, retsBuffer: GPUBuffer | null): GPUBindGroupEntry[];
    materializeTree(tree: SNodeTree): void;
    addTexture(texture: TextureBase): void;
    createGPUTexture(dimensions: number[], dimensionality: TextureDimensionality, format: GPUTextureFormat, renderAttachment: boolean, requires_storage: boolean): GPUTexture;
    createGPUSampler(depth: boolean): GPUSampler;
    createGPUCanvasContext(htmlCanvas: HTMLCanvasElement): [GPUCanvasContext, GPUTextureFormat];
    deviceToHost(field: Field, offsetBytes?: number, sizeBytes?: number): Promise<FieldHostSideCopy>;
    hostToDevice(field: Field, hostArray: Int32Array, offsetBytes?: number): Promise<void>;
    getRootBuffer(treeId: number): GPUBuffer;
    copyHtmlImageToTexture(image: HTMLImageElement, texture: GPUTexture): Promise<void>;
    copyHtmlImagesToCubeTexture(images: HTMLImageElement[], texture: GPUTexture): Promise<void>;
}
declare class FieldHostSideCopy {
    intArray: number[];
    floatArray: number[];
    constructor(intArray: number[], floatArray: number[]);
}
export { Runtime };
