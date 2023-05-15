import { Type } from '../language/frontend/Type';
import { Field } from './Field';
export declare class FieldFactory {
    static createField(type: Type, dimensions: number[], fragmentShaderWritable?: boolean): Field;
}
