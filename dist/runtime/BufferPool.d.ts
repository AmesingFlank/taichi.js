/// <reference types="dist" />
export declare class BufferPool {
    private device;
    usage: GPUBufferUsageFlags;
    private constructor();
    private static pools;
    static getPool(device: GPUDevice, usage: GPUBufferUsageFlags): BufferPool;
    private buffers;
    getBuffer(size: number): GPUBuffer;
    returnBuffer(buffer: GPUBuffer, size: number): void;
}
