import { Field } from './Field'
import { nextPowerOf2 } from "../utils/Utils"
import { Type } from "../language/frontend/Type"

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

class SNodeTree {
    treeId: number = 0
    fields: Field[] = []
    size: number = 0
    rootBuffer: GPUBuffer | null = null
    fragmentShaderWritable = false
    constructor() {
    }

    addNaiveDenseField(elementType: Type, dimensionsArg: number[] | number): Field {
        let dimensions: number[]
        if (typeof dimensionsArg === "number") {
            dimensions = [dimensionsArg]
        }
        else {
            dimensions = dimensionsArg
        }

        let packed = true

        let primitivesList = elementType.getPrimitivesList()
        let totalSize = 4 * primitivesList.length * numElements(dimensions, packed)
        let field = new Field(this, this.size, totalSize, dimensions, elementType)

        this.size += totalSize
        this.fields.push(field)

        return field
    }
}

export { SNodeTree }