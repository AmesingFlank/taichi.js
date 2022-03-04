
import {nativeTaichi, NativeTaichiAny} from "../native/taichi/GetTaichi"
import {error} from "../utils/Logging"

enum PrimitiveType {
    i32 = "i32",
    f32 = "f32"
}

function toNativePrimitiveType(type:PrimitiveType): NativeTaichiAny{
    switch(type){
        case PrimitiveType.i32: {
            return nativeTaichi.PrimitiveType.i32
        }
        case PrimitiveType.f32: {
            return nativeTaichi.PrimitiveType.f32
        }
    }
}

class Type {
    public constructor(
        public primitiveType:PrimitiveType,
        public isScalar: boolean = true,
        public numRows: number = 1,
        public numCols: number = 1
    ){

    }

    copy(){
        return new Type(this.primitiveType, this.isScalar, this.numRows, this.numCols)
    }
    isVector(){
        return !this.isScalar && this.numCols === 1;
    }
    isMatrix(){
        return !this.isScalar && this.numCols > 1;
    }
}

enum FrontendTypeCategory {
    Scalar = "Scalar",
    Vector = "Vector",
    Matrix = "Matrix"
}

class FrontendType {
    constructor(){

    }

    getCategory():FrontendTypeCategory{
        error("calling getCategory from FrontendType base")
        return FrontendTypeCategory.Scalar
    }

    isScalar(): boolean {
        return this.getCategory() == FrontendTypeCategory.Scalar
    }

    isVector(): boolean {
        return this.getCategory() == FrontendTypeCategory.Vector
    }

    isMatrix(): boolean {
        return this.getCategory() == FrontendTypeCategory.Matrix
    }

    public equals(that: FrontendType): boolean{
        error("calling equlas from FrontendType base")
        return false
    }
}

class ScalarType extends FrontendType {
    constructor(primitiveType:PrimitiveType){
        super()
        this.primitiveType_ = primitiveType
    }
    
    private primitiveType_:PrimitiveType

    override getCategory():FrontendTypeCategory{
        return FrontendTypeCategory.Scalar
    }

    getPrimitiveType() : PrimitiveType {
        return this.primitiveType_;
    }

    public equals(that: FrontendType): boolean{
        if(that.getCategory() != this.getCategory()){
            return false;
        }
        return this.getPrimitiveType() === (that as ScalarType).getPrimitiveType()
    }
}



export {Type, PrimitiveType, toNativePrimitiveType}