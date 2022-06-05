import * as ti from "../../taichi"

export class DrawInfo {
    constructor(
        public indexCount: number = 0,
        public instanceCount: number = 0,
        public firstIndex: number = 0,
        public baseVertex: number = 0,
        public firstInstance: number = 0
    ) {

    }

    static getKernelType() {
        return ti.types.struct({
            indexCount: ti.i32,
            instanceCount: ti.i32,
            firstIndex: ti.i32,
            baseVertex: ti.i32,
            firstInstance: ti.i32
        })
    }
} 
 