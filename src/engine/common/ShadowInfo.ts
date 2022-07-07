import { LightInfo } from "./LightInfo";
import * as ti from "../../taichi"

export class ShadowInfo {
    constructor(public physicalSize: number[], public maxDistance: number, public shadowMapResolution: number[] = [1024, 1024], public strength = 1.0) {

    }
    view: number[][] = []
    projection: number[][] = []
    viewProjection: number[][] = []

    static createIblShadowInfo(representativePosition: number[], representativeDirection: number[], physicalSize: number[], maxDistance: number, shadowMapResolution: number[] = [1024, 1024], strength = 1.0) {
        let shadow = new ShadowInfo(physicalSize, maxDistance, shadowMapResolution, strength)
        shadow.view = ti.lookAt(representativePosition, ti.add(representativePosition, representativeDirection), [0.0, 1.0, 0.0]);
        let size = physicalSize
        shadow.projection = ti.ortho(-0.5 * size[0], 0.5 * size[0], -0.5 * size[1], 0.5 * size[0], 0.0, maxDistance)
        shadow.viewProjection = ti.matmul(shadow.projection, shadow.view)
        return shadow
    }
}
