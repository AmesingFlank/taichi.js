import {
    CompiledTask,
    CompiledKernel,
    TaskParams,
    ResourceType,
    KernelParams,
    ResourceBinding,
    CompiledRenderPipeline,
    RenderPipelineParams,
    CompiledRenderPassInfo,
} from './Kernel';
import { SNodeTree } from '../data/SNodeTree';
import { divUp, elementToInt32Array, int32ArrayToElement } from '../utils/Utils';
import { assert, error } from '../utils/Logging';
import { Field } from '../data/Field';
import { TypeCategory } from '../language/frontend/Type';
import { TextureBase, TextureDimensionality, TextureSamplingOptions } from '../data/Texture';
import { PipelineCache } from './PipelineCache';
import { BufferPool, PooledBuffer } from './BufferPool';

class Runtime {
    adapter: GPUAdapter | null = null;
    device: GPUDevice | null = null;
    kernels: CompiledKernel[] = [];
    materializedTrees: SNodeTree[] = [];
    textures: TextureBase[] = [];

    private globalTmpsBuffer: GPUBuffer | null = null;
    private randStatesBuffer: GPUBuffer | null = null;
    private pipelineCache: PipelineCache | null = null;

    constructor() {}

    async init() {
        await this.createDevice();
        this.createGlobalTmpsBuffer();
        this.createRandStatesBuffer();
    }

    async createDevice() {
        let alertWebGPUError = () => {
            alert(`Webgpu not supported. Please ensure that you have Chrome v113+`);
        };
        if (!navigator.gpu) {
            alertWebGPUError();
        }
        const adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
        });
        if (!adapter) {
            alertWebGPUError();
        }
        const requiredFeatures: GPUFeatureName[] = [];
        if (adapter!.features.has('indirect-first-instance')) {
            requiredFeatures.push('indirect-first-instance');
        }

        const device = await adapter!.requestDevice({
            requiredFeatures,
        });
        if (!device) {
            alertWebGPUError();
        }
        this.device = device;
        this.adapter = adapter;
        this.pipelineCache = new PipelineCache(device);
    }

    createKernel(params: KernelParams): CompiledKernel {
        let kernel = new CompiledKernel();
        for (let taskParams of params.tasksParams) {
            if (taskParams instanceof TaskParams) {
                let task = new CompiledTask(taskParams, this);
                kernel.tasks.push(task);
            } else if (taskParams instanceof RenderPipelineParams) {
                assert(params.renderPassParams !== null);
                let task = new CompiledRenderPipeline(taskParams, params.renderPassParams!, this);
                kernel.tasks.push(task);
            }
        }
        if (params.renderPassParams !== null) {
            kernel.renderPassInfo = new CompiledRenderPassInfo(params.renderPassParams);
        }
        kernel.argTypes = params.argTypes;
        kernel.returnType = params.returnType;
        return kernel;
    }

    async sync() {
        await this.device!.queue.onSubmittedWorkDone();
    }

    async launchKernel(kernel: CompiledKernel, ...args: any[]): Promise<any> {
        assert(
            args.length === kernel.argTypes.length,
            `Kernel requires ${kernel.argTypes.length} arguments, but ${args.length} is provided`
        );

        let requiresArgsBuffer = false;
        let requiresRetsBuffer = false;
        let thisArgsBuffer: GPUBuffer | undefined = undefined;
        let thisRetsBufferGPU: PooledBuffer | undefined = undefined;
        let thisRetsBufferCPU: PooledBuffer | undefined = undefined;
        let argsSize: number = 0;
        let retsSize: number = 0;
        for (let task of kernel.tasks) {
            for (let binding of task.params.bindings) {
                if (binding.info.resourceType === ResourceType.Args) {
                    requiresArgsBuffer = true;
                }
                if (binding.info.resourceType === ResourceType.Rets) {
                    requiresRetsBuffer = true;
                }
            }
        }
        if (requiresArgsBuffer) {
            let numArgPrims = 0;
            for (let type of kernel.argTypes) {
                numArgPrims += type.getPrimitivesList().length;
            }

            let argData = new Int32Array(numArgPrims);
            let offset = 0;
            for (let i = 0; i < args.length; ++i) {
                let type = kernel.argTypes[i];
                let thisArgData = elementToInt32Array(args[i], type);
                argData.set(thisArgData, offset);
                offset += type.getPrimitivesList().length;
            }
            argsSize = numArgPrims * 4;
            thisArgsBuffer = this.addArgsBuffer(argsSize);
            new Int32Array(thisArgsBuffer.getMappedRange()).set(argData);
            thisArgsBuffer.unmap();
        }

        let retsBufferPoolGPU = BufferPool.getPool(this.device!, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        let retsBufferPoolCPU = BufferPool.getPool(this.device!, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);

        if (requiresRetsBuffer) {
            retsSize = kernel.returnType.getPrimitivesList().length * 4;
            thisRetsBufferGPU = retsBufferPoolGPU.getBuffer(retsSize);
            thisRetsBufferCPU = retsBufferPoolCPU.getBuffer(retsSize);
        }

        let commandEncoder = this.device!.createCommandEncoder();
        let computeEncoder: GPUComputePassEncoder | null = null;
        let renderEncoder: GPURenderPassEncoder | null = null;

        let computeState: EncoderState = new EncoderState();
        let renderState: EncoderState = new EncoderState();

        let endCompute = () => {
            if (computeEncoder) {
                computeEncoder.end();
            }
            computeEncoder = null;
            computeState = new EncoderState();
        };
        let endRender = () => {
            if (renderEncoder) {
                renderEncoder.end();
            }
            renderEncoder = null;
            renderState = new EncoderState();
        };
        let beginCompute = () => {
            endRender();
            if (!computeEncoder) {
                computeEncoder = commandEncoder.beginComputePass();
                computeState = new EncoderState();
            }
        };
        let beginRender = () => {
            endCompute();
            if (!renderEncoder) {
                assert(kernel.renderPassInfo !== null, 'render pass info is null');
                renderEncoder = commandEncoder.beginRenderPass(kernel.renderPassInfo!.getGPURenderPassDescriptor());
                renderState = new EncoderState();
            }
        };

        let indirectPolyfills = new Map<CompiledRenderPipeline, IndirectPolyfillInfo>();
        for (let task of kernel.tasks) {
            if (task instanceof CompiledRenderPipeline) {
                if (task.params.indirectBuffer) {
                    if (task.params.indirectCount !== 1 || !this.supportsIndirectFirstInstance()) {
                        let polyfill = new IndirectPolyfillInfo(task.params.indirectBuffer, task.params.indirectCount);
                        await polyfill.fillInfo();
                        indirectPolyfills.set(task, polyfill);
                    }
                }
            }
        }

        for (let task of kernel.tasks) {
            task.bindGroup = this.device!.createBindGroup({
                layout: task.pipeline!.getBindGroupLayout(0),
                entries: this.getGPUBindGroupEntries(task.params.bindings, thisArgsBuffer, thisRetsBufferGPU?.buffer),
            });

            if (task instanceof CompiledTask) {
                beginCompute();
                if (computeState.computePipeline !== task.pipeline!) {
                    computeEncoder!.setPipeline(task.pipeline!);
                    computeState.computePipeline = task.pipeline!;
                }
                computeEncoder!.setBindGroup(0, task.bindGroup!);
                let workgroupSize = task.params.workgroupSize;
                let numWorkgroups = task.params.numWorkgroups;

                computeEncoder!.dispatchWorkgroups(numWorkgroups);
            } else if (task instanceof CompiledRenderPipeline) {
                beginRender();
                if (renderState.renderPipeline !== task.pipeline!) {
                    renderEncoder!.setPipeline(task.pipeline!);
                    renderState.renderPipeline = task.pipeline!;
                }
                renderEncoder!.setBindGroup(0, task.bindGroup!);

                if (task.params.vertexBuffer) {
                    let vertexBufferTree = this.materializedTrees[task.params.vertexBuffer.snodeTree.treeId];
                    renderEncoder!.setVertexBuffer(
                        0,
                        vertexBufferTree.rootBuffer!,
                        task.params.vertexBuffer.offsetBytes,
                        task.params.vertexBuffer.sizeBytes
                    );
                }

                if (task.params.indexBuffer) {
                    let indexBufferTree = this.materializedTrees[task.params.indexBuffer.snodeTree.treeId];
                    renderEncoder!.setIndexBuffer(
                        indexBufferTree.rootBuffer!,
                        'uint32',
                        task.params.indexBuffer.offsetBytes,
                        task.params.indexBuffer.sizeBytes
                    );
                }
                if (!task.params.indirectBuffer) {
                    if (task.params.indexBuffer) {
                        renderEncoder!.drawIndexed(task.getVertexCount());
                    } else {
                        renderEncoder!.draw(task.getVertexCount());
                    }
                } else {
                    if (
                        task.params.indirectCount === 1 &&
                        this.supportsIndirectFirstInstance() &&
                        task.params.indirectBuffer instanceof Field
                    ) {
                        let indirectBufferTree = this.materializedTrees[task.params.indirectBuffer.snodeTree.treeId];
                        renderEncoder!.drawIndexedIndirect(
                            indirectBufferTree.rootBuffer!,
                            task.params.indirectBuffer.offsetBytes
                        );
                    } else {
                        assert(indirectPolyfills.has(task));
                        let polyfill = indirectPolyfills.get(task)!;
                        for (let draw of polyfill.commands) {
                            renderEncoder!.drawIndexed(
                                draw.indexCount,
                                draw.instanceCount,
                                draw.firstIndex,
                                draw.baseVertex,
                                draw.firstInstance
                            );
                        }
                    }
                }
            }
        }
        endCompute();
        endRender();
        this.device!.queue.submit([commandEncoder.finish()]);

        /**
         * launchKernel is an async function
         * when the user launches a kernel by writing `k()`, we don't await on the Promise returned by launchKernel
         * in other words, `k(); await.ti.sync();` is equivalent to `await k()`, assuming k has no return value
         * This is pretty neat. Should C++ taichi do the same? e.g. with C++ coroutines?
         */
        await this.sync();

        if (thisArgsBuffer) {
            this.recycleArgsBuffer(thisArgsBuffer, argsSize);
        }

        if (kernel.returnType.getCategory() !== TypeCategory.Void) {
            assert(thisRetsBufferGPU !== null && thisRetsBufferCPU !== null, 'missing rets buffer!');

            let commandEncoder = this.device!.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(thisRetsBufferGPU!.buffer, 0, thisRetsBufferCPU!.buffer, 0, retsSize);
            this.device!.queue.submit([commandEncoder.finish()]);
            await this.device!.queue.onSubmittedWorkDone();

            await thisRetsBufferCPU!.buffer.mapAsync(GPUMapMode.READ, 0, retsSize);
            let intArray = new Int32Array(thisRetsBufferCPU!.buffer.getMappedRange(0, retsSize));
            let returnVal = int32ArrayToElement(intArray, kernel.returnType);

            thisRetsBufferCPU!.buffer.unmap();
            retsBufferPoolGPU.returnBuffer(thisRetsBufferGPU!);
            retsBufferPoolCPU.returnBuffer(thisRetsBufferCPU!);

            return returnVal;
        }
    }

    private addArgsBuffer(size: number): GPUBuffer {
        // can't use a buffer pool, because we need the mappedAtCreation feature.
        // or we could use two buffers, one for MAP_WRITE and COPY_SRC, the other for STORAGE and UNIFORM
        // but that's probably not worth it.
        let buffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });
        return buffer;
    }

    private recycleArgsBuffer(buffer: GPUBuffer, size: number) {
        buffer.destroy();
    }

    private createGlobalTmpsBuffer() {
        let size = 65536;
        this.globalTmpsBuffer = this.device!.createBuffer({
            size: size,
            usage: GPUBufferUsage.STORAGE,
        });
    }

    private createRandStatesBuffer() {
        this.randStatesBuffer = this.device!.createBuffer({
            size: 65536 * 4 * 4,
            usage: GPUBufferUsage.STORAGE,
        });
    }

    getGPUBindGroupEntries(
        bindings: ResourceBinding[],
        argsBuffer: GPUBuffer | undefined,
        retsBuffer: GPUBuffer | undefined
    ): GPUBindGroupEntry[] {
        let entries: GPUBindGroupEntry[] = [];
        for (let binding of bindings) {
            let buffer: GPUBuffer | undefined = undefined;
            let texture: GPUTextureView | undefined = undefined;
            let sampler: GPUSampler | undefined = undefined;
            switch (binding.info.resourceType) {
                case ResourceType.Root:
                case ResourceType.RootAtomic: {
                    buffer = this.materializedTrees[binding.info.resourceID!].rootBuffer!;
                    break;
                }
                case ResourceType.GlobalTmps:
                case ResourceType.GlobalTmpsAtomic: {
                    buffer = this.globalTmpsBuffer!;
                    break;
                }
                case ResourceType.Args: {
                    assert(argsBuffer !== null);
                    buffer = argsBuffer!;
                    break;
                }
                case ResourceType.Rets: {
                    assert(retsBuffer !== null);
                    buffer = retsBuffer!;
                    break;
                }
                case ResourceType.RandStates: {
                    buffer = this.randStatesBuffer!;
                    break;
                }
                case ResourceType.StorageTexture:
                case ResourceType.Texture: {
                    texture = this.textures[binding.info.resourceID!].getGPUTextureView();
                    break;
                }
                case ResourceType.Sampler: {
                    sampler = this.textures[binding.info.resourceID!].getGPUSampler();
                    break;
                }
            }
            if (buffer) {
                entries.push({
                    binding: binding.binding,
                    resource: {
                        buffer: buffer,
                    },
                });
            } else if (texture) {
                entries.push({
                    binding: binding.binding,
                    resource: texture,
                });
            } else if (sampler) {
                entries.push({
                    binding: binding.binding,
                    resource: sampler,
                });
            } else {
                error("couldn't identify resource");
            }
        }
        return entries;
    }

    materializeTree(tree: SNodeTree) {
        let size = tree.size;
        let rootBuffer = this.device!.createBuffer({
            size: size,
            usage:
                GPUBufferUsage.STORAGE |
                GPUBufferUsage.VERTEX |
                GPUBufferUsage.INDEX |
                GPUBufferUsage.COPY_DST |
                GPUBufferUsage.COPY_SRC |
                GPUBufferUsage.INDIRECT,
        });
        tree.rootBuffer = rootBuffer;
        this.materializedTrees.push(tree);
    }

    addTexture(texture: TextureBase) {
        this.textures.push(texture);
    }

    createGPUTexture(
        dimensions: number[],
        dimensionality: TextureDimensionality,
        format: GPUTextureFormat,
        renderAttachment: boolean,
        requiresStorage: boolean,
        sampleCount: number
    ): GPUTexture {
        let getDescriptor = (): GPUTextureDescriptor => {
            let usage = GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING;
            if (requiresStorage) {
                usage = usage | GPUTextureUsage.STORAGE_BINDING;
            }
            if (dimensions.length === 1) {
                error('1d texture not supported yet');
                return {
                    size: { width: dimensions[0] },
                    dimension: '1d',
                    format: format,
                    usage: usage,
                };
            } else if (dimensions.length === 2) {
                assert(
                    dimensionality === TextureDimensionality.Dim2d || dimensionality === TextureDimensionality.DimCube
                );
                if (renderAttachment) {
                    usage = usage | GPUTextureUsage.RENDER_ATTACHMENT;
                }
                let size: GPUExtent3DStrict = { width: dimensions[0], height: dimensions[1] };
                if (dimensionality === TextureDimensionality.DimCube) {
                    size.depthOrArrayLayers = 6;
                }
                return {
                    size: size,
                    dimension: '2d',
                    format: format,
                    usage: usage,
                    sampleCount,
                };
            } else {
                // if(dimensions.length === 3){
                return {
                    size: { width: dimensions[0], height: dimensions[1], depthOrArrayLayers: dimensions[2] },
                    dimension: '3d',
                    format: format,
                    usage: usage,
                };
            }
        };
        return this.device!.createTexture(getDescriptor());
    }

    createGPUSampler(depth: boolean, samplingOptions: TextureSamplingOptions): GPUSampler {
        let desc: GPUSamplerDescriptor = {
            addressModeU: samplingOptions.wrapModeU || 'repeat',
            addressModeV: samplingOptions.wrapModeV || 'repeat',
            addressModeW: samplingOptions.wrapModeW || 'repeat',
            minFilter: 'linear',
            magFilter: 'linear',
            mipmapFilter: 'linear',
            maxAnisotropy: 16,
        };
        if (depth) {
            desc.compare = 'less-equal';
        }
        return this.device!.createSampler(desc);
    }

    createGPUCanvasContext(htmlCanvas: HTMLCanvasElement): [GPUCanvasContext, GPUTextureFormat] {
        let context = htmlCanvas.getContext('webgpu');
        if (context === null) {
            error('canvas webgpu context is null');
        }
        let presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        context!.configure({
            device: this.device!,
            format: presentationFormat,
            alphaMode: 'opaque',
        });
        return [context!, presentationFormat];
    }

    async deviceToHost(field: Field, offsetBytes: number = 0, sizeBytes: number = 0): Promise<FieldHostSideCopy> {
        if (sizeBytes === 0) {
            sizeBytes = field.sizeBytes;
        }
        let pool = BufferPool.getPool(this.device!, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
        const rootBufferCopy = pool.getBuffer(sizeBytes);
        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.materializedTrees[field.snodeTree.treeId].rootBuffer!,
            field.offsetBytes + offsetBytes,
            rootBufferCopy.buffer,
            0,
            sizeBytes
        );
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.sync();

        await rootBufferCopy.buffer.mapAsync(GPUMapMode.READ, 0, sizeBytes);
        let mappedRange = rootBufferCopy.buffer.getMappedRange(0, sizeBytes);
        let resultInt = Array.from(new Int32Array(mappedRange));
        let resultFloat = Array.from(new Float32Array(mappedRange));
        rootBufferCopy.buffer.unmap();
        pool.returnBuffer(rootBufferCopy);
        return new FieldHostSideCopy(resultInt, resultFloat);
    }

    async hostToDevice(field: Field, hostArray: Int32Array, offsetBytes: number = 0) {
        const rootBufferCopy = this.device!.createBuffer({
            size: hostArray.byteLength,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            mappedAtCreation: true,
        });

        new Int32Array(rootBufferCopy.getMappedRange()).set(hostArray);
        rootBufferCopy.unmap();

        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            rootBufferCopy,
            0,
            this.materializedTrees[field.snodeTree.treeId].rootBuffer!,
            field.offsetBytes + offsetBytes,
            hostArray.byteLength
        );
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.device!.queue.onSubmittedWorkDone();

        rootBufferCopy.destroy();
    }

    getRootBuffer(treeId: number): GPUBuffer {
        return this.materializedTrees[treeId].rootBuffer!;
    }
    async copyImageBitmapToTexture(bitmap: ImageBitmap, texture: GPUTexture) {
        let copySource: GPUImageCopyExternalImage = {
            source: bitmap,
        };
        let copyDest: GPUImageCopyTextureTagged = {
            texture: texture,
        };
        let extent: GPUExtent3D = {
            width: bitmap.width,
            height: bitmap.height,
        };
        this.device!.queue.copyExternalImageToTexture(copySource, copyDest, extent);
        await this.device!.queue.onSubmittedWorkDone();
    }
    async copyImageBitmapsToCubeTexture(bitmaps: ImageBitmap[], texture: GPUTexture) {
        for (let i = 0; i < 6; ++i) {
            let bitmap = bitmaps[i];
            let copySource: GPUImageCopyExternalImage = {
                source: bitmap,
            };
            let copyDest: GPUImageCopyTextureTagged = {
                texture: texture,
                origin: [0, 0, i],
            };
            let extent: GPUExtent3D = {
                width: bitmap.width,
                height: bitmap.height,
            };
            this.device!.queue.copyExternalImageToTexture(copySource, copyDest, extent);
        }
        await this.device!.queue.onSubmittedWorkDone();
    }
    async copyTextureToTexture(src: GPUTexture, dest: GPUTexture, dimensions: number[]) {
        let commandEncoder = this.device!.createCommandEncoder();
        commandEncoder.copyTextureToTexture({ texture: src }, { texture: dest }, dimensions);
        this.device!.queue.submit([commandEncoder.finish()]);
        await this.device!.queue.onSubmittedWorkDone();
    }

    getGPUShaderModule(code: string): GPUShaderModule {
        return this.pipelineCache!.getOrCreateShaderModule(code);
    }

    getGPUComputePipeline(desc: GPUComputePipelineDescriptor): GPUComputePipeline {
        return this.pipelineCache!.getOrCreateComputePipeline(desc);
    }

    getGPURenderPipeline(desc: GPURenderPipelineDescriptor): GPURenderPipeline {
        return this.pipelineCache!.getOrCreateRenderPipeline(desc);
    }

    private supportsIndirectFirstInstance() {
        return this.adapter!.features.has('indirect-first-instance');
    }
}

class FieldHostSideCopy {
    constructor(public intArray: number[], public floatArray: number[]) {}
}

class IndirectDrawCommand {
    constructor(
        public indexCount: number,
        public instanceCount: number,
        public firstIndex: number,
        public baseVertex: number,
        public firstInstance: number
    ) {}
}

class IndirectPolyfillInfo {
    constructor(public indirectBuffer: Promise<number[]> | Field, public indirectCount: number | Field) {}
    commands: IndirectDrawCommand[] = [];
    async fillInfo() {
        if (this.indirectCount instanceof Field) {
            this.indirectCount = (await this.indirectCount.toInt32Array())[0];
        }
        let indirectBufferHost: number[] = [];
        if (this.indirectBuffer instanceof Field) {
            indirectBufferHost = await this.indirectBuffer.toInt32Array();
        } else {
            indirectBufferHost = await this.indirectBuffer;
        }
        this.commands = [];
        for (let i = 0; i < this.indirectCount; ++i) {
            let values = indirectBufferHost.slice(i * 5, i * 5 + 5);
            let cmd = new IndirectDrawCommand(values[0], values[1], values[2], values[3], values[4]);
            this.commands.push(cmd);
        }
    }
}

class EncoderState {
    computePipeline?: GPUComputePipeline;
    renderPipeline?: GPURenderPipeline;
}

export { Runtime };
