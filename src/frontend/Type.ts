
import {nativeTaichi, NativeTaichiAny} from "../native/taichi/GetTaichi"

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

export {Type, PrimitiveType, toNativePrimitiveType}