/// <reference types="dist" />
export interface PooledBuffer {
    buffer: GPUBuffer;
    size: number;
}
export declare class BufferPool {
    private device;
    usage: GPUBufferUsageFlags;
    private constructor();
    private static pools;
    static getPool(device: GPUDevice, usage: GPUBufferUsageFlags): BufferPool;
    private buffers;
    getBuffer(size: number): PooledBuffer;
    returnBuffer(buffer: PooledBuffer): void;
}
