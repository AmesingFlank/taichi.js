import {Program} from '../program/Program'
import { Field } from '../program/Field'
import { PrimitiveType, Type }from "../frontend/Type"


function field( primitiveType:PrimitiveType, dimensions: number[]|number) : Field{
    let elementType = new Type(primitiveType,true,1,1)
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
}

let Vector = {
    field : (n:number, primitiveType:PrimitiveType, dimensions:number[]|number):Field => {
        let elementType = new Type(primitiveType,false,n,1)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

let Matrix = {
    field : (n:number, m:number, primitiveType:PrimitiveType, dimensions:number[]|number):Field => {
        let elementType = new Type(primitiveType,false,n,m)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

export {field,Vector,Matrix}