import {Program} from './Program'
import { Field } from './Field'



function field(dimensions: number[]) : Field{
    return Program.getCurrentProgram().partialTree.addNaiveDenseField(4,[],dimensions)
}

let Vector = {
    field : (n:number, dimensions:number[]):Field => {
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(4 *n,[n],dimensions)
    }
}

let Matrix = {
    field : (m:number, n:number, dimensions:number[]):Field => {
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(4 *n *m,[n,m],dimensions)
    }
}

export {field,Vector,Matrix}