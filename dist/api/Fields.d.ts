import { Field } from '../data/Field';
import { PrimitiveType, Type } from "../frontend/Type";
declare function field(type: PrimitiveType | Type, dimensions: number[] | number): Field;
declare let Vector: {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number) => Field;
};
declare let Matrix: {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number) => Field;
};
declare let Struct: {
    field: (members: any, dimensions: number[] | number) => Field;
};
export { field, Vector, Matrix, Struct };
