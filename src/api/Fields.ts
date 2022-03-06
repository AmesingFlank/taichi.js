import {Program} from '../program/Program'
import { Field } from '../program/Field'
import { PrimitiveType, Type,ScalarType,VectorType,MatrixType }from "../frontend/Type"


function field( primitiveType:PrimitiveType, dimensions: number[]|number) : Field{
    let elementType = new ScalarType(primitiveType)
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
}

let Vector = {
    field : (n:number, primitiveType:PrimitiveType, dimensions:number[]|number):Field => {
        let elementType = new VectorType(primitiveType,n)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

let Matrix = {
    field : (n:number, m:number, primitiveType:PrimitiveType, dimensions:number[]|number):Field => {
        let elementType = new MatrixType(primitiveType,n,m)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

export {field,Vector,Matrix}