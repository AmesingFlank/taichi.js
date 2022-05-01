import * as ti from "../../taichi"

export class InstanceInfo {
    constructor(
        public nodeIndex: number = 0
    ) {

    }
    static getKernelType() {
        return ti.types.struct({
            nodeIndex: ti.i32
        })
    }
}