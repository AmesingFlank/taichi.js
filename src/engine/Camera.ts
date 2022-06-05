import * as ti from "../taichi"

export class Camera {
    constructor(
        public position: number[],
        public direction: number[],
        public up: number[] = [0.0, 1.0, 0.0],
        public fov: number = 45,
        public near: number = 0.1,
        public far: number = 1000
    ) {

    }
    static getKernelType(): any {
        return ti.types.struct({
            position: ti.types.vector(ti.f32, 3),
            direction: ti.types.vector(ti.f32, 3),
            up: ti.types.vector(ti.f32, 3),
            fov: ti.f32,
            near: ti.f32,
            far: ti.f32
        })
    }
} 