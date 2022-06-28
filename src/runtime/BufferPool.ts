export interface PooledBuffer {
    buffer: GPUBuffer,
    size: number
}

export class BufferPool {
    private constructor(private device: GPUDevice, public usage: GPUBufferUsageFlags) {

    }

    private static pools: Map<GPUBufferUsageFlags, BufferPool> = new Map<GPUBufferUsageFlags, BufferPool>()

    public static getPool(device: GPUDevice, usage: GPUBufferUsageFlags) {
        if (!this.pools.has(usage)) {
            let pool = new BufferPool(device, usage)
            this.pools.set(usage, pool)
        }
        return this.pools.get(usage)!
    }

    private buffers: Set<PooledBuffer> = new Set<PooledBuffer>()

    public getBuffer(size: number): PooledBuffer {
        let selectedPair: PooledBuffer | undefined = undefined
        for (let pair of this.buffers.keys()) {
            if (pair.size >= size) {
                selectedPair = pair
                break;
            }
        }
        if (selectedPair) {
            this.buffers.delete(selectedPair)
            return selectedPair
        }
        let buffer = this.device.createBuffer({
            size: size,
            usage: this.usage
        })
        return {
            buffer: buffer,
            size: size
        }
    }

    public returnBuffer(buffer: PooledBuffer) {
        this.buffers.add(buffer)
    }
}