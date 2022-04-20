import * as ti from "../../taichi"

export interface Vertex {
    position: number[],
    normal: number[],
    texCoords: number[],
    materialID: number
}

export const vertexType = ti.types.struct({
    position: ti.types.vector(ti.f32, 3),
    normal: ti.types.vector(ti.f32, 3),
    texCoords: ti.types.vector(ti.f32, 2),
    materialID: ti.i32
})