import type { SNodeTree } from './SNodeTree'
import { NativeTaichiAny, nativeTaichi } from "../native/taichi/GetTaichi"
import { MatrixType, PrimitiveType, Type, TypeCategory, TypeUtils, VectorType } from "../frontend/Type"
import { Program } from "./Program"
import { error } from '../utils/Logging'
import { MultiDimensionalArray } from '../utils/MultiDimensionalArray'

function groupByN<T>(arr: T[], n:number) : T[][]{
    let result : T[][] = []
    let current:T[] = []
    for(let i = 0; i < arr.length; ++i){
        current.push(arr[i])
        if(current.length === n){
            result.push(current)
            current = []
        }
    }
    return result
}

function groupVectors<T>(raw: T[], numRows: number): T[][]{
    return groupByN(raw, numRows);
}

function groupMatrices<T>(raw: T[], numRows: number, numCols:number): T[][][]{
    let flatMats = groupByN(raw, numCols * numRows)
    let result: T[][][] = []
    for(let flatMat of flatMats){
        result.push(groupByN(flatMat, numCols))
    }
    return result
}

function groupTensorElements(intArray: number[], floatArray:number[], elementType: Type) : MultiDimensionalArray<number> {
    let selectedArray = intArray
    if(TypeUtils.getPrimitiveType(elementType) === PrimitiveType.f32){
        selectedArray = floatArray
    }
    if(elementType.getCategory() === TypeCategory.Scalar){
        return selectedArray
    }
    else if(elementType.getCategory() === TypeCategory.Vector){
        let vecType = elementType as VectorType
        return groupVectors(selectedArray, vecType.getNumRows())
    }
    else if(elementType.getCategory() === TypeCategory.Matrix){
        let matType = elementType as MatrixType
        return groupMatrices(selectedArray, matType.getNumRows(), matType.getNumCols())
    }
    else{
        error("expecting tensor type")
        return []
    }
}

function groupElements(intArray: number[], floatArray:number[], elementType: Type): any[] {
    if(TypeUtils.isTensorType(elementType)){
        return groupTensorElements(intArray, floatArray, elementType)
    }
    else{
        error("unsupported field element type")
        return []
    }
}

function reshape<T>(elements: T[], dimensions:number[]): MultiDimensionalArray<T>{
    let result: MultiDimensionalArray<T> = elements
    for(let i = dimensions.length-1; i > 0; -- i){
        let thisDim = dimensions[i]
        result = groupByN<T>(result as ((typeof result[0])[]), thisDim)
    }
    return result
}

class Field {
    constructor(
        public snodeTree: SNodeTree,
        public offset: number,
        public size: number,
        public dimensions: number[],
        public placeNodes: NativeTaichiAny[],
        public elementType: Type
    ) {

    }

    async toArray1D(): Promise<number[]> {
        if (TypeUtils.isTensorType(this.elementType)) {
            let copy = await Program.getCurrentProgram().runtime!.copyFieldToHost(this);
            if(TypeUtils.getPrimitiveType(this.elementType) === PrimitiveType.f32){
                return copy.floatArray;
            }
            else{
                return copy.intArray;
            }
        }
        else {
            error("toArray1D can only be used for scalar/vector/matrix fields")
            return []
        }
    }

    async toArray(): Promise<any[]> {
        let copy = await Program.getCurrentProgram().runtime!.copyFieldToHost(this);
        let elements1D = groupElements(copy.intArray, copy.floatArray, this.elementType)
        return reshape(elements1D, this.dimensions)
    }
}

export { Field }