import { VectorType, MatrixType, PrimitiveType, StructType } from "../frontend/Type";
export declare function vector(primitiveType: PrimitiveType, n: number): VectorType;
export declare function matrix(primitiveType: PrimitiveType, n: number, m: number): MatrixType;
export declare function struct(members: any): StructType;
export declare type vector = any;
export declare type matrix = any;
export declare type struct = any;
