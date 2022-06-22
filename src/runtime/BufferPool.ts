

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

    private buffers: Set<[GPUBuffer, number]> = new Set<[GPUBuffer, number]>()

    public getBuffer(size: number): GPUBuffer {
        let selectedPair: [GPUBuffer, number] | undefined = undefined
        for (let pair of this.buffers.keys()) {
            if (pair[1] >= size) {
                selectedPair = pair
                break;
            }
        }
        if (selectedPair) {
            this.buffers.delete(selectedPair)
            return selectedPair[0]
        }
        let buffer = this.device.createBuffer({
            size: size,
            usage: this.usage
        })
        return buffer
    }

    public returnBuffer(buffer: GPUBuffer, size: number) {
        this.buffers.add([buffer, size])
    }
}