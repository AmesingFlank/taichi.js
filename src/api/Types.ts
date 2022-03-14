import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, PrimitiveType, TypeUtils, StructType } from "../frontend/Type"


let types = {
    vector(primitiveType: PrimitiveType, n: number) {
        return new VectorType(primitiveType, n)
    },

    matrix(primitiveType: PrimitiveType, n: number, m: number) {
        return new MatrixType(primitiveType, n, m)
    },

    struct(members: any) {
        return new StructType(members)
    }
}

export { types }