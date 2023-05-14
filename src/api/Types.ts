import { VectorType, MatrixType, PrimitiveType, StructType } from '../language/frontend/Type';

export function vector(primitiveType: PrimitiveType, n: number) {
    return new VectorType(primitiveType, n);
}

export function matrix(primitiveType: PrimitiveType, n: number, m: number) {
    return new MatrixType(primitiveType, n, m);
}

export function struct(members: any) {
    return new StructType(members);
}

export type vector = any;
export type matrix = any;
export type struct = any;
