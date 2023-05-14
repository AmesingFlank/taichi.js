import { Type } from '../language/frontend/Type';
import { Program } from '../program/Program';
import { product } from '../utils/Utils';
import { Field } from './Field';

export class FieldFactory {
    static createField(type: Type, dimensions: number[], fragmentShaderWritable: boolean = false): Field {
        //let thisFieldSize = type.getPrimitivesList().length * 4 * product(dimensions)
        if (fragmentShaderWritable) {
            Program.getCurrentProgram().materializeCurrentTree();
        }
        let field = Program.getCurrentProgram().partialTree.addNaiveDenseField(type, dimensions);
        if (fragmentShaderWritable) {
            field.snodeTree.fragmentShaderWritable = true;
            Program.getCurrentProgram().materializeCurrentTree();
        }
        return field;
    }
}
