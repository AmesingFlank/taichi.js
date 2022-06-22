/// <reference types="dist" />
import { Type } from "../language/frontend/Type";
import { DepthTexture, TextureBase } from "../data/Texture";
import { Field } from "../data/Field";
import { Runtime } from "./Runtime";
declare enum ResourceType {
    Root = 0,
    RootAtomic = 1,
    GlobalTmps = 2,
    Args = 3,
    RandStates = 4,
    Rets = 5,
    Texture = 6,
    Sampler = 7,
    StorageTexture = 8
}
declare class ResourceInfo {
    resourceType: ResourceType;
    resourceID?: number | undefined;
    constructor(resourceType: ResourceType, resourceID?: number | undefined);
    equals(that: ResourceInfo): boolean;
}
declare class ResourceBinding {
    info: ResourceInfo;
    binding: number;
    constructor(info: ResourceInfo, binding: number);
    equals(that: ResourceBinding): boolean;
}
declare class TaskParams {
    code: string;
    workgroupSize: number;
    numWorkgroups: number;
    bindings: ResourceBinding[];
    constructor(code: string, workgroupSize: number, numWorkgroups: number, bindings?: ResourceBinding[]);
}
declare class VertexShaderParams {
    code: string;
    bindings: ResourceBinding[];
    constructor(code?: string, bindings?: ResourceBinding[]);
}
declare class FragmentShaderParams {
    code: string;
    bindings: ResourceBinding[];
    constructor(code?: string, bindings?: ResourceBinding[]);
}
declare class RenderPipelineParams {
    vertex: VertexShaderParams;
    fragment: FragmentShaderParams;
    interpolatedType: Type;
    vertexBuffer: Field | null;
    indexBuffer: Field | null;
    indirectBuffer: Field | null;
    constructor(vertex: VertexShaderParams, fragment: FragmentShaderParams, interpolatedType?: Type, vertexBuffer?: Field | null, indexBuffer?: Field | null, indirectBuffer?: Field | null);
    bindings: ResourceBinding[];
    indirectCount: number | Field;
    getBindings(): ResourceBinding[];
}
interface ColorAttachment {
    texture: TextureBase;
    clearColor?: number[];
}
interface DepthAttachment {
    texture: DepthTexture;
    clearDepth?: number;
    storeDepth?: boolean;
}
interface RenderPassParams {
    colorAttachments: ColorAttachment[];
    depthAttachment: DepthAttachment | null;
}
declare class KernelParams {
    tasksParams: (TaskParams | RenderPipelineParams)[];
    argTypes: Type[];
    returnType: Type;
    renderPassParams: RenderPassParams | null;
    constructor(tasksParams: (TaskParams | RenderPipelineParams)[], argTypes: Type[], returnType: Type, renderPassParams?: RenderPassParams | null);
}
declare class CompiledTask {
    params: TaskParams;
    pipeline: GPUComputePipeline | null;
    bindGroup: GPUBindGroup | null;
    constructor(params: TaskParams, runtime: Runtime);
    createPipeline(runtime: Runtime): void;
}
declare class CompiledRenderPipeline {
    params: RenderPipelineParams;
    pipeline: GPURenderPipeline | null;
    bindGroup: GPUBindGroup | null;
    constructor(params: RenderPipelineParams, renderPassParams: RenderPassParams, runtime: Runtime);
    private getGPUVertexBufferStates;
    private getGPUColorTargetStates;
    getVertexCount(): number;
    createPipeline(runtime: Runtime, renderPassParams: RenderPassParams): void;
}
declare class CompiledRenderPassInfo {
    params: RenderPassParams;
    constructor(params: RenderPassParams);
    getGPURenderPassDescriptor(): GPURenderPassDescriptor;
}
declare class CompiledKernel {
    tasks: (CompiledTask | CompiledRenderPipeline)[];
    argTypes: Type[];
    returnType: Type;
    renderPassInfo: CompiledRenderPassInfo | null;
    constructor(tasks?: (CompiledTask | CompiledRenderPipeline)[], argTypes?: Type[], returnType?: Type, renderPassInfo?: CompiledRenderPassInfo | null);
}
export { CompiledTask, CompiledKernel, TaskParams, ResourceType, ResourceInfo, ResourceBinding, KernelParams, VertexShaderParams, FragmentShaderParams, RenderPipelineParams, CompiledRenderPipeline, RenderPassParams, ColorAttachment, DepthAttachment, CompiledRenderPassInfo };
