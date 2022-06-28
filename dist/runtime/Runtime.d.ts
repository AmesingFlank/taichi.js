/// <reference types="dist" />
import { CompiledKernel, KernelParams, ResourceBinding } from './Kernel';
import { SNodeTree } from '../data/SNodeTree';
import { Field } from '../data/Field';
import { TextureBase, TextureDimensionality, TextureSamplingOptions } from '../data/Texture';
declare class Runtime {
    adapter: GPUAdapter | null;
    device: GPUDevice | null;
    kernels: CompiledKernel[];
    materializedTrees: SNodeTree[];
    textures: TextureBase[];
    private globalTmpsBuffer;
    private randStatesBuffer;
    private pipelineCache;
    constructor();
    init(): Promise<void>;
    createDevice(): Promise<void>;
    createKernel(params: KernelParams): CompiledKernel;
    sync(): Promise<void>;
    launchKernel(kernel: CompiledKernel, ...args: any[]): Promise<any>;
    private addArgsBuffer;
    private recycleArgsBuffer;
    private createGlobalTmpsBuffer;
    private createRandStatesBuffer;
    getGPUBindGroupEntries(bindings: ResourceBinding[], argsBuffer: GPUBuffer | undefined, retsBuffer: GPUBuffer | undefined): GPUBindGroupEntry[];
    materializeTree(tree: SNodeTree): void;
    addTexture(texture: TextureBase): void;
    createGPUTexture(dimensions: number[], dimensionality: TextureDimensionality, format: GPUTextureFormat, renderAttachment: boolean, requiresStorage: boolean, sampleCount: number): GPUTexture;
    createGPUSampler(depth: boolean, samplingOptions: TextureSamplingOptions): GPUSampler;
    createGPUCanvasContext(htmlCanvas: HTMLCanvasElement): [
        GPUCanvasContext,
        GPUTextureFormat
    ];
    deviceToHost(field: Field, offsetBytes?: number, sizeBytes?: number): Promise<FieldHostSideCopy>;
    hostToDevice(field: Field, hostArray: Int32Array, offsetBytes?: number): Promise<void>;
    getRootBuffer(treeId: number): GPUBuffer;
    copyImageBitmapToTexture(bitmap: ImageBitmap, texture: GPUTexture): Promise<void>;
    copyImageBitmapsToCubeTexture(bitmaps: ImageBitmap[], texture: GPUTexture): Promise<void>;
    getGPUShaderModule(code: string): GPUShaderModule;
    getGPUComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline;
    getGPURenderPipeline(desc: GPURenderPipelineDescriptor): GPURenderPipeline;
    private supportsIndirectFirstInstance;
}
declare class FieldHostSideCopy {
    intArray: number[];
    floatArray: number[];
    constructor(intArray: number[], floatArray: number[]);
}
export { Runtime };
