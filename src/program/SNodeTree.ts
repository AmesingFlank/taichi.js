import { Field } from './Field'
import { nativeTaichi, NativeTaichiAny } from "../native/taichi/GetTaichi"
import { nextPowerOf2 } from "../utils/Utils"
import { PrimitiveType, toNativePrimitiveType, Type, TypeCategory, VectorType, MatrixType, TypeUtils } from "../frontend/Type"
import { error } from '../utils/Logging'

function numElements(dimensions: number[], packed: boolean = false) {
    let result = 1
    for (let d of dimensions) {
        if (packed) {
            result *= d
        }
        else {
            result *= nextPowerOf2(d)
        }
    }
    return result
}

function product(arr: number[]) {
    let result = 1
    for (let d of arr) {
        result *= d
    }
    return result
}

class SNodeTree {
    treeId: number = 0
    fields: Field[] = []
    size: number = 0
    nativeTreeRoot: NativeTaichiAny
    constructor() {
        this.nativeTreeRoot = new nativeTaichi.SNode(0, nativeTaichi.SNodeType.root);
    }

    addNaiveDenseField(elementType: Type, dimensionsArg: number[] | number): Field {
        let dimensions: number[]
        if (typeof dimensionsArg === "number") {
            dimensions = [dimensionsArg]
        }
        else {
            dimensions = dimensionsArg
        }

        let axisVec: NativeTaichiAny = new nativeTaichi.VectorOfAxis()
        let sizesVec: NativeTaichiAny = new nativeTaichi.VectorOfInt()
        for (let i = 0; i < dimensions.length; ++i) {
            axisVec.push_back(new nativeTaichi.Axis(i))
            sizesVec.push_back(dimensions[i])
        }

        let packed = true

        let dense = this.nativeTreeRoot.dense(axisVec, sizesVec, packed);

        let primitivesList = elementType.getPrimitivesList()
        let placeNodes: NativeTaichiAny[] = []
        for (let i = 0; i < primitivesList.length; ++i) {
            let place = dense.insert_children(nativeTaichi.SNodeType.place);
            place.dt_set(toNativePrimitiveType(primitivesList[i]))
            placeNodes.push(place)
        }

        let totalSize = 4 * primitivesList.length * numElements(dimensions, packed)
        let field = new Field(this, this.size, totalSize, dimensions, placeNodes, elementType)

        this.size += totalSize
        this.fields.push(field)

        return field
    }
}

export { SNodeTree }