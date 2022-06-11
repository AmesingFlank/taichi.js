import { Program } from '../program/Program'
import { Field } from '../data/Field'
import { CanvasTexture, CubeTexture, DepthTexture, Texture, TextureSamplingOptions, WrapMode } from '../data/Texture'
import { PrimitiveType, Type, ScalarType, VectorType, MatrixType, StructType } from "../language/frontend/Type"
import { product } from '../utils/Utils'
import { error } from '../utils/Logging'
import { FieldFactory } from '../data/FieldFactory'



let texture = (numComponents: number, dimensions: number[], sampleCount: number = 1, samplingOptions: TextureSamplingOptions = {}) => {
    return new Texture(numComponents, dimensions, sampleCount, samplingOptions)
}

let canvasTexture = (canvas: HTMLCanvasElement, sampleCount: number = 1) => {
    return new CanvasTexture(canvas, sampleCount)
}

let depthTexture = (dimensions: number[], sampleCount: number = 1) => {
    return new DepthTexture(dimensions, sampleCount)
}

export { texture, canvasTexture, depthTexture, Texture, CubeTexture, TextureSamplingOptions, WrapMode }