import { Type } from "../language/frontend/Type";
import { Program } from "../program/Program";
import { product } from "../utils/Utils";
import { Field } from "./Field";

export class FieldFactory {
    static createField(type: Type, dimensions: number[]): Field {
        let thisFieldSize = type.getPrimitivesList().length * 4 * product(dimensions)
        if (thisFieldSize + Program.getCurrentProgram().partialTree.size > 65536) {
            // we need to throw an error if the vertex/frament shader uses a SNodeTree of size more than 64kB.
            // this ensures that if a SNodeTree is > 64KB, it has only one field, so the error message would be more readable and actionable
            Program.getCurrentProgram().materializeCurrentTree()
        }
        return Program.getCurrentProgram().partialTree.addNaiveDenseField(type, dimensions)
    }
}