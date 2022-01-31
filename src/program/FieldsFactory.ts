import {Program} from './Program'
import { Field } from './Field'



function field(dimensions: number[]) : Field{
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(4,1,1,dimensions)
}

let Vector = {
    field : (n:number, dimensions:number[]):Field => {
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(4 *n,n,1,dimensions)
    }
}

let Matrix = {
    field : (n:number, m:number, dimensions:number[]):Field => {
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(4 *n *m,n,m,dimensions)
    }
}

export {field,Vector,Matrix}