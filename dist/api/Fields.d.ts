import { Field } from '../data/Field';
import { PrimitiveType, Type } from "../language/frontend/Type";
export declare function field(type: PrimitiveType | Type, dimensions: number[] | number, fragmentShaderWritable?: boolean): Field;
export declare const Vector: {
    field: (n: number, primitiveType: PrimitiveType, dimensions: number[] | number, fragmentShaderWritable?: boolean) => Field;
};
export declare const Matrix: {
    field: (n: number, m: number, primitiveType: PrimitiveType, dimensions: number[] | number, fragmentShaderWritable?: boolean) => Field;
};
export declare const Struct: {
    field: (members: any, dimensions: number[] | number, fragmentShaderWritable?: boolean) => Field;
};
export declare function materializeFields(): void;
