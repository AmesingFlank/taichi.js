import { Type } from "../language/frontend/Type";
import { Program } from "../program/Program";
import { product } from "../utils/Utils";
import { Field } from "./Field";

export class FieldFactory {
    static createField(type: Type, dimensions: number[]): Field {
        //let thisFieldSize = type.getPrimitivesList().length * 4 * product(dimensions)
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(type, dimensions)
    }
}