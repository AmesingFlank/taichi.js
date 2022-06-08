import * as ti from "../taichi"

export enum LightType {
    Point = 1,
    Spot = 2,
    Directional = 3,
}

export class LightInfo {
    constructor(
        public type: LightType,
        public brightness: number,
        public color: number[],
        public influenceRadius: number,
        public position: number[] = [0.0, 0.0, 0.0], // point and spot
        public direction: number[] = [0.0, 0.0, 0.0], // spot and dir
        public innerConeAngle: number = 0,
        public outerConeAngle: number = Math.PI / 4,
    ) {

    }

    static getKernelType() {
        return ti.types.struct({
            type: ti.i32,
            brightness: ti.f32,
            color: ti.types.vector(ti.f32, 3),
            influenceRadius: ti.f32,
            position: ti.types.vector(ti.f32, 3),
            direction: ti.types.vector(ti.f32, 3),
            innerConeAngle: ti.f32,
            outerConeAngle: ti.f32
        })
    }
}