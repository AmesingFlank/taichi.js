import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, PrimitiveType, TypeUtils } from "../frontend/Type"


let types = {
    vector(primitiveType:PrimitiveType, n:number){
        return new VectorType(primitiveType, n)
    },

    matrix(primitiveType:PrimitiveType, n:number, m:number ){
        return new MatrixType(primitiveType, n, m)
    },
}

export {types}