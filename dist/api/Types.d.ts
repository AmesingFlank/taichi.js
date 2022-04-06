import { VectorType, MatrixType, PrimitiveType, StructType } from "../frontend/Type";
declare let types: {
    vector(primitiveType: PrimitiveType, n: number): VectorType;
    matrix(primitiveType: PrimitiveType, n: number, m: number): MatrixType;
    struct(members: any): StructType;
};
export { types };
