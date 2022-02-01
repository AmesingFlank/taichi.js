import {Program} from './Program'
import { Field } from './Field'
import { PrimitiveType, Type }from "../frontend/Type"


function field(dimensions: number[], primitiveType:PrimitiveType) : Field{
    let elementType = new Type(primitiveType,true,1,1)
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
}

let Vector = {
    field : (n:number, dimensions:number[], primitiveType:PrimitiveType):Field => {
        let elementType = new Type(primitiveType,false,n,1)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

let Matrix = {
    field : (n:number, m:number, dimensions:number[], primitiveType:PrimitiveType):Field => {
        let elementType = new Type(primitiveType,false,n,m)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(elementType,dimensions)
    }
}

export {field,Vector,Matrix}