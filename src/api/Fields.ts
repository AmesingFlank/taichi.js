import { Program } from '../program/Program'
import { Field } from '../program/Field'
import { PrimitiveType, Type, ScalarType, VectorType, MatrixType, StructType } from "../frontend/Type"


function field(type: PrimitiveType | Type, dimensions: number[] | number): Field {
    if (type === PrimitiveType.f32 || type === PrimitiveType.i32) {
        type = new ScalarType(type)
    }
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(type, dimensions)
}

let Vector = {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new VectorType(primitiveType, n)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
    }
}

let Matrix = {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number): Field => {
        let elementType = new MatrixType(primitiveType, n, m)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
    }
}

let Struct = {
    field: (members: any, dimensions: number[] | number): Field => {
        let elementType = new StructType(members)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType, dimensions)
    }
}

export { field, Vector, Matrix, Struct }