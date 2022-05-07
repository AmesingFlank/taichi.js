import { Program } from '../program/Program'
import { Field } from '../data/Field'
import { CanvasTexture, CubeTexture, DepthTexture, Texture } from '../data/Texture'
import { PrimitiveType, Type, ScalarType, VectorType, MatrixType, StructType } from "../frontend/Type"
import { product } from '../utils/Utils'
import { error } from '../utils/Logging'
import { FieldFactory } from '../data/FieldFactory'



let texture = (numComponents: number, dimensions: number[], sampleCount: number = 1) => {
    return new Texture(numComponents, dimensions, sampleCount)
}

let canvasTexture = (canvas: HTMLCanvasElement, sampleCount: number = 1) => {
    return new CanvasTexture(canvas, sampleCount)
}

let depthTexture = (dimensions: number[], sampleCount: number = 1) => {
    return new DepthTexture(dimensions, sampleCount)
}

export { texture, canvasTexture, depthTexture, Texture, CubeTexture }