import { Type } from "../frontend/Type";
import { Field } from "./Field";
export declare class FieldFactory {
    static createField(type: Type, dimensions: number[]): Field;
}
