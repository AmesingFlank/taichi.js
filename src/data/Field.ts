import type { SNodeTree } from './SNodeTree'
import { NativeTaichiAny } from "../native/taichi/GetTaichi"
import { PrimitiveType, Type, TypeUtils } from "../frontend/Type"
import { Program } from "../program/Program"
import { assert, error } from '../utils/Logging'
import { elementToInt32Array, groupElements, reshape, toElement } from '../utils/Utils'

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

    async toInt32Array(): Promise<number[]>{
        let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this);
        return copy.intArray
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

export { Field }