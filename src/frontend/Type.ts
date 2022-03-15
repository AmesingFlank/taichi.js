
import { nativeTaichi, NativeTaichiAny } from "../native/taichi/GetTaichi"
import { assert, error } from "../utils/Logging"

enum PrimitiveType {
    i32 = "i32",
    f32 = "f32"
}

function toNativePrimitiveType(type: PrimitiveType): NativeTaichiAny {
    switch (type) {
        case PrimitiveType.i32: {
            return nativeTaichi.PrimitiveType.i32
        }
        case PrimitiveType.f32: {
            return nativeTaichi.PrimitiveType.f32
        }
    }
}

enum TypeCategory {
    Scalar = "Scalar",
    Vector = "Vector",
    Matrix = "Matrix",
    Struct = "Struct",
    Pointer = "Pointer",
    Void = "Void"
}

class Type {
    constructor() {

    }

    getCategory(): TypeCategory {
        error("calling getCategory from Type2 base")
        return TypeCategory.Scalar
    }

    public equals(that: Type): boolean {
        error("calling equals from Type2 base")
        return false
    }

    getPrimitivesList(): PrimitiveType[] {
        error("calling getPrimitivesList from Type base")
        return []
    }
}

class ScalarType extends Type {
    constructor(primitiveType: PrimitiveType) {
        super()
        this.primitiveType_ = primitiveType
    }

    private primitiveType_: PrimitiveType

    override getCategory(): TypeCategory {
        return TypeCategory.Scalar
    }

    getPrimitiveType(): PrimitiveType {
        return this.primitiveType_;
    }

    override getPrimitivesList(): PrimitiveType[] {
        return [this.primitiveType_]
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        return this.getPrimitiveType() === (that as ScalarType).getPrimitiveType()
    }
}

class VectorType extends Type {
    constructor(primitiveType: PrimitiveType, numRows: number) {
        super()
        this.primitiveType_ = primitiveType
        this.numRows_ = numRows
    }

    private primitiveType_: PrimitiveType
    private numRows_: number

    override getCategory(): TypeCategory {
        return TypeCategory.Vector
    }

    getPrimitiveType(): PrimitiveType {
        return this.primitiveType_;
    }

    getNumRows(): number {
        return this.numRows_;
    }

    override getPrimitivesList(): PrimitiveType[] {
        let primitives = []
        for (let i = 0; i < this.getNumRows(); ++i) {
            primitives.push(this.primitiveType_)
        }
        return primitives
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        let thatVector = that as VectorType
        return this.getPrimitiveType() === thatVector.getPrimitiveType() &&
            this.getNumRows() === thatVector.getNumRows()
    }
}


class MatrixType extends Type {
    constructor(primitiveType: PrimitiveType, numRows: number, numCols: number) {
        super()
        this.primitiveType_ = primitiveType
        this.numRows_ = numRows
        this.numCols_ = numCols
    }

    private primitiveType_: PrimitiveType
    private numRows_: number
    private numCols_: number

    override getCategory(): TypeCategory {
        return TypeCategory.Matrix
    }

    getPrimitiveType(): PrimitiveType {
        return this.primitiveType_;
    }

    getNumRows(): number {
        return this.numRows_;
    }

    getNumCols(): number {
        return this.numCols_;
    }

    override getPrimitivesList(): PrimitiveType[] {
        let primitives = []
        for (let i = 0; i < this.getNumRows() * this.getNumCols(); ++i) {
            primitives.push(this.primitiveType_)
        }
        return primitives
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        let thatVector = that as MatrixType
        return this.getPrimitiveType() === thatVector.getPrimitiveType() &&
            this.getNumRows() === thatVector.getNumRows() &&
            this.getNumCols() === thatVector.getNumCols()
    }
}

class PointerType extends Type {
    constructor(valueType: Type, isGlobal: boolean) {
        super()
        this.valueType_ = valueType
        this.isGlobal_ = isGlobal
    }

    private valueType_: Type
    private isGlobal_: boolean

    getValueType(): Type {
        return this.valueType_
    }

    getIsGlobal(): boolean {
        return this.isGlobal_
    }

    override getCategory(): TypeCategory {
        return TypeCategory.Pointer
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        let thatPointer = that as PointerType
        return this.getValueType().equals(thatPointer.getValueType())
    }

    override getPrimitivesList(): PrimitiveType[] {
        error("calling getPrimitivesList from PointerType")
        return []
    }
}

class StructType extends Type {
    constructor(membersMap: any) {
        super()
        this.keys_ = Object.keys(membersMap)
        this.memberTypes_ = new Map<string, Type>()
        for (let k of this.keys_) {
            let memberType = membersMap[k]
            if (memberType === PrimitiveType.f32 || memberType === PrimitiveType.i32) {
                memberType = new ScalarType(memberType)
            }
            this.memberTypes_.set(k, memberType)
        }
    }

    private keys_: string[] // ordered
    private memberTypes_: Map<string, Type>

    getPropertyNames(): string[] {
        return this.keys_;
    }

    getPropertyType(name: string): Type {
        if (!this.memberTypes_.has(name)) {
            error(`property ${name} does not exist on this struct`)
        }
        return this.memberTypes_.get(name)!
    }

    getPropertyPrimitiveOffset(name: string): number {
        if (!this.memberTypes_.has(name)) {
            error(`property ${name} does not exist on this struct`)
        }
        let offset = 0
        for (let k of this.keys_) {
            if (k !== name) {
                offset += this.getPropertyType(k).getPrimitivesList().length
            }
            else{
                break;
            }
        }
        return offset
    }

    override getCategory(): TypeCategory {
        return TypeCategory.Struct
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        let thatStruct = that as StructType
        if (this.keys_.length !== thatStruct.keys_.length) {
            return false
        }
        for (let i = 0; i < this.keys_.length; ++i) {
            if (this.keys_[i] !== thatStruct.keys_[i]) {
                return false
            }
            let key = this.keys_[i]
            if (!this.memberTypes_.get(key)!.equals(thatStruct.memberTypes_.get(key)!)) {
                return false
            }
        }
        return true
    }

    override getPrimitivesList(): PrimitiveType[] {
        let prims: PrimitiveType[] = []
        for (let k of this.keys_) {
            prims = prims.concat(this.getPropertyType(k).getPrimitivesList())
        }
        return prims
    }
}

class VoidType extends Type {
    constructor() {
        super()
    }
    override getCategory(): TypeCategory {
        return TypeCategory.Void
    }

    override equals(that: Type): boolean {
        if (that.getCategory() != this.getCategory()) {
            return false;
        }
        return true
    }

    override getPrimitivesList(): PrimitiveType[] {
        return []
    }
}


class TypeUtils {

    static isTensorType(type: Type): boolean {
        let cat = type.getCategory();
        return cat === TypeCategory.Scalar || cat === TypeCategory.Vector || cat === TypeCategory.Matrix
    }

    static tensorTypeShapeMatch(type0: Type, type1: Type) {
        assert(TypeUtils.isTensorType(type0) && TypeUtils.isTensorType(type1), "[Compiler bug] tensorTypeShapeMatch() called on non-tensor type")
        if (type0.getCategory() !== type1.getCategory()) {
            return false
        }
        if (type0.getCategory() === TypeCategory.Scalar) {
            return true
        }
        else if (type0.getCategory() === TypeCategory.Vector) {
            let vec0 = type0 as VectorType
            let vec1 = type1 as VectorType
            return vec0.getNumRows() === vec1.getNumRows()
        }
        else {// if(type0.getCategory() === TypeCategory.Matrix)
            let mat0 = type0 as MatrixType
            let mat1 = type1 as MatrixType
            return mat0.getNumRows() === mat1.getNumRows() && mat0.getNumCols() === mat1.getNumCols()
        }
    }

    static getPrimitiveType(type: Type): PrimitiveType {
        assert(TypeUtils.isTensorType(type), "[Compiler bug] getPrimitiveType() called on non-tensor type")
        let cat = type.getCategory();
        if (cat === TypeCategory.Scalar) {
            return (type as ScalarType).getPrimitiveType()
        }
        else if (cat === TypeCategory.Vector) {
            let vecType = type as VectorType
            return vecType.getPrimitiveType()
        }
        else { //if(cat ===  TypeCategory.Matrix)
            let matType = type as MatrixType
            return matType.getPrimitiveType()
        }
    }

    static replacePrimitiveType(type: Type, newPrimitiveType: PrimitiveType): Type {
        assert(TypeUtils.isTensorType(type), "[Compiler bug] replacePrimitiveType() called on non-tensor type")
        let cat = type.getCategory();
        if (cat === TypeCategory.Scalar) {
            return new ScalarType(newPrimitiveType)
        }
        else if (cat === TypeCategory.Vector) {
            let vecType = type as VectorType
            return new VectorType(newPrimitiveType, vecType.getNumRows())
        }
        else { // if(cat ===  TypeCategory.Matrix){
            let matType = type as MatrixType
            return new MatrixType(newPrimitiveType, matType.getNumRows(), matType.getNumCols())
        }
    }

    static isPointerOfCategory(type: Type, cat: TypeCategory) {
        return type.getCategory() === TypeCategory.Pointer && (type as PointerType).getValueType().getCategory() === cat;
    }

    static isValueOrPointerOfCategory(type: Type, cat: TypeCategory) {
        return type.getCategory() === cat || TypeUtils.isPointerOfCategory(type, cat)
    }

    static isPointerOfTensorType(type: Type): boolean {
        return type.getCategory() === TypeCategory.Pointer && TypeUtils.isTensorType((type as PointerType).getValueType())
    }

    static isValueOrPointerOfTensorType(type: Type): boolean {
        return TypeUtils.isTensorType(type) || TypeUtils.isPointerOfTensorType(type)
    }
}

class TypeError {
    private constructor(public hasError: boolean, public msg: string = "") {

    }
    public static createNoError() {
        return new TypeError(false)
    }
    public static createError(msg: string) {
        return new TypeError(true, msg)
    }
}

export { PrimitiveType, toNativePrimitiveType }
export { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, TypeUtils, TypeError, StructType }