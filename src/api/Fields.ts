import { Program } from '../program/Program'
import { CanvasTexture, DepthTexture, Field, Texture } from '../program/Field'
import { PrimitiveType, Type, ScalarType, VectorType, MatrixType, StructType } from "../frontend/Type"


function field(type: PrimitiveType | Type, dimensions: number[] | number): Field {
    if (type === PrimitiveType.f32 || type === PrimitiveType.i32) {
        type = new ScalarType(type)
    }
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(type, dimensions)
}

// we need to throw an error if the vertex/frament shader uses a SNodeTree of size more than 64kB.
// if fields and snode trees have 1-1 correspondence, then the error message would be more readable and actionable
const useSeparateTreeForEachField = true

let Vector = {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new VectorType(primitiveType, n)
        let field = Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
        if(useSeparateTreeForEachField){
            Program.getCurrentProgram().materializeCurrentTree()
        }
        return field
    }
}

let Matrix = {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new MatrixType(primitiveType, n, m)
        let field = Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
        if(useSeparateTreeForEachField){
            Program.getCurrentProgram().materializeCurrentTree()
        }
        return field
    }
}

let Struct = {
    field: (members: any, dimensions: number[] | number): Field => {
        let elementType = new StructType(members)
        let field = Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
        if(useSeparateTreeForEachField){
            Program.getCurrentProgram().materializeCurrentTree()
        }
        return field
    }
}

let texture = (primitiveType: PrimitiveType, numComponents:number, dimensions: number[])=> {
    return new Texture(primitiveType,numComponents,dimensions)
}

let canvasTexture = (canvas: HTMLCanvasElement) => {
    return new CanvasTexture(canvas)
}

let depthTexture = (dimensions: number[]) => {
    return new DepthTexture(dimensions)
}

export { field, Vector, Matrix, Struct, texture, canvasTexture, depthTexture }