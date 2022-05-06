import * as ti from "../../taichi"

export enum LightType {
    Point = 1,
}

export class LightInfo {
    constructor(
        public type: LightType,
        public position: number[],
        public brightness: number,
        public color: number[],
        public influenceRadius: number
    ) {

    }

    static getKernelType() {
        return ti.types.struct({
            type: ti.i32,
            position: ti.types.vector(ti.f32, 3),
            brightness: ti.f32,
            color: ti.types.vector(ti.f32, 3),
            influenceRadius: ti.f32,
        })
    }
}