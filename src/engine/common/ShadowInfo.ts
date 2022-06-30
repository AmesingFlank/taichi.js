import { LightInfo } from "./LightInfo";


export class ShadowInfo {
    constructor(public physicalSize: number[], public maxDistance: number, public shadowMapResolution: number[] = [1024, 1024]) {

    }
    view: number[][] = []
    projection: number[][] = []
    viewProjection: number[][] = []
}