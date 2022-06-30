import * as ti from "../../taichi"
import { ShadowInfo } from "./ShadowInfo"

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
        public castsShadow: boolean = false,
        public shadow: ShadowInfo | undefined = undefined
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
            outerConeAngle: ti.f32,
            castsShadow: ti.i32
        })
    }
}

export class PointLightInfo extends LightInfo {
    constructor(
        brightness: number,
        color: number[],
        influenceRadius: number,
        position: number[],
        castsShadow: boolean = false,
        shadow: ShadowInfo | undefined = undefined
    ) {
        super(LightType.Point, brightness, color, influenceRadius, position, [0.0, 0.0, 0.0], 0.0, 0.0, castsShadow, shadow)
    }
}
export class SpotLightInfo extends LightInfo {
    constructor(
        brightness: number,
        color: number[],
        influenceRadius: number,
        position: number[],
        direction: number[], // spot and dir
        public innerConeAngle: number = 0,
        public outerConeAngle: number = Math.PI / 4,
        castsShadow: boolean = false,
        shadow: ShadowInfo | undefined = undefined
    ) {
        super(LightType.Spot, brightness, color, influenceRadius, position, direction, innerConeAngle, outerConeAngle, castsShadow, shadow)
    }
}

export class DirectionalLightInfo extends LightInfo {
    constructor(
        brightness: number,
        color: number[],
        direction: number[], // spot and dir 
        castsShadow: boolean = false,
        shadowStartingPosition: number[] = [0.0, 0.0, 0.0],
        shadow: ShadowInfo | undefined = undefined
    ) {
        super(LightType.Directional, brightness, color, 0.0, shadowStartingPosition, direction, 0.0, 0.0, castsShadow, shadow)
    }
}