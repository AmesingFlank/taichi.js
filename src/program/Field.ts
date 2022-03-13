import type { SNodeTree } from './SNodeTree'
import { NativeTaichiAny, nativeTaichi } from "../native/taichi/GetTaichi"
import { MatrixType, PrimitiveType, Type, TypeCategory, TypeUtils, VectorType } from "../frontend/Type"
import { Program } from "./Program"
import { assert, error } from '../utils/Logging'
import { MultiDimensionalArray } from '../utils/MultiDimensionalArray'

class Field {
    constructor(
        public snodeTree: SNodeTree,
        public offsetBytes: number,
        public sizeBytes: number,
        public dimensions: number[],
        public placeNodes: NativeTaichiAny[],
        public elementType: Type
    ) {

    }

    async toArray1D(): Promise<number[]> {
        if (TypeUtils.isTensorType(this.elementType)) {
            let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this);
            if (TypeUtils.getPrimitiveType(this.elementType) === PrimitiveType.f32) {
                return copy.floatArray;
            }
            else {
                return copy.intArray;
            }
        }
        else {
            error("toArray1D can only be used for scalar/vector/matrix fields")
            return []
        }
    }

    private ensureMaterialized() {
        Program.getCurrentProgram().materializeCurrentTree()
    }

    async toArray(): Promise<any[]> {
        this.ensureMaterialized()
        let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this);
        let elements1D = groupElements(copy.intArray, copy.floatArray, this.elementType)
        return reshape(elements1D, this.dimensions)
    }

    async get(indices: number[]): Promise<any> {
        this.ensureMaterialized()
        if (indices.length !== this.dimensions.length) {
            error(`indices dimensions mismatch, expecting ${this.dimensions.length}, received ${indices.length}`,)
        }
        for (let i = 0; i < indices.length; ++i) {
            assert(indices[i] < this.dimensions[i], "index out of bounds")
        }
        let index = 0;
        for (let i = 0; i < indices.length - 1; ++i) {
            index = (index + indices[i]) * this.dimensions[i + 1]
        }
        index += indices[indices.length - 1]
        let elementSizeBytes = this.elementType.getPrimitivesList().length * 4
        let offsetBytes = elementSizeBytes * index
        let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this, offsetBytes, elementSizeBytes);
        return toElement(copy.intArray, copy.floatArray, this.elementType)
    }

    async fromArray1D(values: number[]) {
        assert(TypeUtils.isTensorType(this.elementType), "fromArray1D can only be used on fields of scalar/vector/matrix types")
        this.ensureMaterialized()
        assert(values.length * 4 === this.sizeBytes, "size mismatch")

        if (TypeUtils.getPrimitiveType(this.elementType) === PrimitiveType.i32) {
            let intArray = Int32Array.from(values)
            await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray)
        }
        else {
            let floatArray = Float32Array.from(values)
            let intArray = new Int32Array(floatArray.buffer)
            await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray)
        }
    }

    async fromArray(values: any) {
        this.ensureMaterialized()
        let curr = values
        for (let i = 0; i < this.dimensions.length; ++i) {
            if (!Array.isArray(curr)) {
                error("expecting array")
            }
            if (curr.length !== this.dimensions[i]) {
                error("array size mismatch")
            }
            curr = curr[0]
        }
        let values1D = values.flat(this.dimensions.length - 1)

        let int32Arrays: Int32Array[] = []
        // slow. hmm. fix later
        for (let val of values1D) {
            int32Arrays.push(elementToInt32Array(val, this.elementType))
        }

        let elementLength = int32Arrays[0].length
        let totalLength = int32Arrays.length * elementLength
        let result = new Int32Array(totalLength)
        for (let i = 0; i < int32Arrays.length; ++i) {
            result.set(int32Arrays[i], i * elementLength)
        }

        await Program.getCurrentProgram().runtime!.hostToDevice(this, result)
    }

    async set(indices: number[], value: any) {
        this.ensureMaterialized()
        if (indices.length !== this.dimensions.length) {
            error(`indices dimensions mismatch, expecting ${this.dimensions.length}, received ${indices.length}`,)
        }
        for (let i = 0; i < indices.length; ++i) {
            assert(indices[i] < this.dimensions[i], "index out of bounds")
        }
        let index = 0;
        for (let i = 0; i < indices.length - 1; ++i) {
            index = (index + indices[i]) * this.dimensions[i + 1]
        }
        index += indices[indices.length - 1]
        let elementSizeBytes = this.elementType.getPrimitivesList().length * 4
        let offsetBytes = elementSizeBytes * index

        let intArray = elementToInt32Array(value, this.elementType)
        await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray, offsetBytes)
    }
}


function groupByN<T>(arr: T[], n: number): T[][] {
    let result: T[][] = []
    let current: T[] = []
    for (let i = 0; i < arr.length; ++i) {
        current.push(arr[i])
        if (current.length === n) {
            result.push(current)
            current = []
        }
    }
    return result
}

function toTensorElement(intArray: number[], floatArray: number[], elementType: Type): any {
    let selectedArray = intArray
    if (TypeUtils.getPrimitiveType(elementType) === PrimitiveType.f32) {
        selectedArray = floatArray
    }
    if (elementType.getCategory() === TypeCategory.Scalar) {
        return selectedArray[0]
    }
    else if (elementType.getCategory() === TypeCategory.Vector) {
        return selectedArray
    }
    else if (elementType.getCategory() === TypeCategory.Matrix) {
        let matType = elementType as MatrixType
        return groupByN(selectedArray, matType.getNumCols())
    }
    else {
        error("expecting tensor type")
        return []
    }
}

function toElement(intArray: number[], floatArray: number[], elementType: Type): any {
    if (TypeUtils.isTensorType(elementType)) {
        return toTensorElement(intArray, floatArray, elementType)
    }
    else {
        error("unsupported element type")
        return []
    }
}

function groupVectors<T>(raw: T[], numRows: number): T[][] {
    return groupByN(raw, numRows);
}

function groupMatrices<T>(raw: T[], numRows: number, numCols: number): T[][][] {
    let flatMats = groupByN(raw, numCols * numRows)
    let result: T[][][] = []
    for (let flatMat of flatMats) {
        result.push(groupByN(flatMat, numCols))
    }
    return result
}

function groupTensorElements(intArray: number[], floatArray: number[], elementType: Type): MultiDimensionalArray<number> {
    let selectedArray = intArray
    if (TypeUtils.getPrimitiveType(elementType) === PrimitiveType.f32) {
        selectedArray = floatArray
    }
    if (elementType.getCategory() === TypeCategory.Scalar) {
        return selectedArray
    }
    else if (elementType.getCategory() === TypeCategory.Vector) {
        let vecType = elementType as VectorType
        return groupVectors(selectedArray, vecType.getNumRows())
    }
    else if (elementType.getCategory() === TypeCategory.Matrix) {
        let matType = elementType as MatrixType
        return groupMatrices(selectedArray, matType.getNumRows(), matType.getNumCols())
    }
    else {
        error("expecting tensor type")
        return []
    }
}

function groupElements(intArray: number[], floatArray: number[], elementType: Type): any[] {
    if (TypeUtils.isTensorType(elementType)) {
        return groupTensorElements(intArray, floatArray, elementType)
    }
    else {
        error("unsupported field element type")
        return []
    }
}

function reshape<T>(elements: T[], dimensions: number[]): MultiDimensionalArray<T> {
    let result: MultiDimensionalArray<T> = elements
    for (let i = dimensions.length - 1; i > 0; --i) {
        let thisDim = dimensions[i]
        result = groupByN<T>(result as ((typeof result[0])[]), thisDim)
    }
    return result
}

function tensorToNumberArray(tensorValue: number | number[] | number[][], tensorType: Type): number[] {
    if (tensorType.getCategory() === TypeCategory.Scalar) {
        return [tensorValue as number]
    }
    else if (tensorType.getCategory() === TypeCategory.Vector) {
        return tensorValue as number[]
    }
    else if (tensorType.getCategory() === TypeCategory.Matrix) {
        let result: number[] = []
        for (let vec of (tensorValue as number[][])) {
            result = result.concat(vec)
        }
        return result
    }
    else {
        error("expecting tensor type")
        return []
    }
}

function tensorToInt32Array(tensorValue: number | number[] | number[][], tensorType: Type): Int32Array {
    let numberArray = tensorToNumberArray(tensorValue, tensorType)
    if (TypeUtils.getPrimitiveType(tensorType) === PrimitiveType.i32) {
        return Int32Array.from(numberArray)
    }
    else { // f32, do a reinterpret cast
        let f32Array = Float32Array.from(numberArray)
        return new Int32Array(f32Array.buffer)
    }
}

function elementToInt32Array(element: any, elementType: Type): Int32Array {
    if (TypeUtils.isTensorType(elementType)) {
        return tensorToInt32Array(element, elementType)
    }
    else {
        error("unsupported field element type")
        return Int32Array.from([])
    }
}


export { Field }