import * as ti from '../../taichi'

export class BatchInfo {
    constructor(public materialIndex: number) {}
    static getKernelType() {
        return ti.types.struct({
            materialIndex: ti.i32,
        })
    }
}
