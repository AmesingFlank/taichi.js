import { Program } from '../program/Program'
import { Field } from '../data/Field'
import { CanvasTexture, CubeTexture, DepthTexture, Texture } from '../data/Texture'
import { PrimitiveType, Type, ScalarType, VectorType, MatrixType, StructType } from "../frontend/Type"
import { product } from '../utils/Utils'
import { error } from '../utils/Logging'
import { FieldFactory } from '../data/FieldFactory'


function field(type: PrimitiveType | Type, dimensions: number[] | number): Field {
    if (type === PrimitiveType.f32 || type === PrimitiveType.i32) {
        type = new ScalarType(type)
    }
    if (typeof dimensions === "number") {
        dimensions = [dimensions]
    }
    return FieldFactory.createField(type, dimensions)
}

let Vector = {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new VectorType(primitiveType, n)
        return field(elementType, dimensions)
    }
}

let Matrix = {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new MatrixType(primitiveType, n, m)
        return field(elementType, dimensions)
    }
}

let Struct = {
    field: (members: any, dimensions: number[] | number): Field => {
        let elementType = new StructType(members)
        return field(elementType, dimensions)
    }
}

let texture = (numComponents: number, dimensions: number[], sampleCount: number = 1) => {
    return new Texture(numComponents, dimensions, sampleCount)
}

let canvasTexture = (canvas: HTMLCanvasElement, sampleCount: number = 1) => {
    return new CanvasTexture(canvas, sampleCount)
}

let depthTexture = (dimensions: number[], sampleCount: number = 1) => {
    return new DepthTexture(dimensions, sampleCount)
}

let createTextureFromURL = async (url: string) => {
    return await Texture.createFromURL(url)
}

let createCubeTextureFromURL = async (urls: string[]) => {
    if (urls.length !== 6) {
        error("expecting 6 urls for cube texture")
    }
    return await CubeTexture.createFromURL(urls)
}

export { field, Vector, Matrix, Struct, texture, canvasTexture, depthTexture, createTextureFromURL, createCubeTextureFromURL }