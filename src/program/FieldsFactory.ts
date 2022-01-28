import {Program} from './Program'
import { Field } from './Field'

function product(dimensions: number[]){
    let size = 1
    for (let d of dimensions) {
        size = size * d
    }
    return size
}

function field(dimensions: number[]) : Field{
    let size = 4 * product(dimensions)
    return Program.getCurrentProgram().partialTree.addField(size)
}

let Vector = {
    field : (n:number, dimensions:number[]):Field => {
        let size = 4 * n * product(dimensions)
        return Program.getCurrentProgram().partialTree.addField(size)
    }
}

let Matrix = {
    field : (m:number, n:number, dimensions:number[]):Field => {
        let size = 4 * n * m * product(dimensions)
        return Program.getCurrentProgram().partialTree.addField(size)
    }
}

export {field,Vector,Matrix}