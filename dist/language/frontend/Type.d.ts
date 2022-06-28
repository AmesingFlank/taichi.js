export declare enum PrimitiveType {
    i32 = "i32",
    f32 = "f32"
}
export declare enum TypeCategory {
    Scalar = "Scalar",
    Vector = "Vector",
    Matrix = "Matrix",
    Struct = "Struct",
    Pointer = "Pointer",
    Void = "Void",
    Function = "Function",
    HostObjectReference = "HostObjectReference"
}
export declare class Type {
    constructor();
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class ScalarType extends Type {
    constructor(primitiveType: PrimitiveType);
    private primitiveType_;
    getCategory(): TypeCategory;
    getPrimitiveType(): PrimitiveType;
    getPrimitivesList(): PrimitiveType[];
    equals(that: Type): boolean;
}
export declare class VectorType extends Type {
    constructor(primitiveType: PrimitiveType, numRows: number);
    private primitiveType_;
    private numRows_;
    getCategory(): TypeCategory;
    getPrimitiveType(): PrimitiveType;
    getNumRows(): number;
    getPrimitivesList(): PrimitiveType[];
    equals(that: Type): boolean;
}
export declare class MatrixType extends Type {
    constructor(primitiveType: PrimitiveType, numRows: number, numCols: number);
    private primitiveType_;
    private numRows_;
    private numCols_;
    getCategory(): TypeCategory;
    getPrimitiveType(): PrimitiveType;
    getNumRows(): number;
    getNumCols(): number;
    getPrimitivesList(): PrimitiveType[];
    equals(that: Type): boolean;
}
export declare class PointerType extends Type {
    constructor(valueType: Type, isGlobal: boolean);
    private valueType_;
    private isGlobal_;
    getValueType(): Type;
    getIsGlobal(): boolean;
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class StructType extends Type {
    constructor(membersMap: any);
    private keys_;
    private memberTypes_;
    getPropertyNames(): string[];
    getPropertyType(name: string): Type;
    getPropertyPrimitiveOffset(name: string): number;
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class VoidType extends Type {
    constructor();
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class FunctionType extends Type {
    constructor();
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class HostObjectReferenceType extends Type {
    markedAsStatic: boolean;
    constructor(markedAsStatic: boolean);
    getCategory(): TypeCategory;
    equals(that: Type): boolean;
    getPrimitivesList(): PrimitiveType[];
}
export declare class TypeUtils {
    static isTensorType(type: Type): boolean;
    static tensorTypeShapeMatch(type0: Type, type1: Type): boolean;
    static getPrimitiveType(type: Type): PrimitiveType;
    static replacePrimitiveType(type: Type, newPrimitiveType: PrimitiveType): Type;
    static isPointerOfCategory(type: Type, cat: TypeCategory): boolean;
    static isValueOrPointerOfCategory(type: Type, cat: TypeCategory): boolean;
    static isPointerOfTensorType(type: Type): boolean;
    static isValueOrPointerOfTensorType(type: Type): boolean;
}
export declare class TypeError {
    hasError: boolean;
    msg: string;
    private constructor();
    static createNoError(): TypeError;
    static createError(msg: string): TypeError;
}
