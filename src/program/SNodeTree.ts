import {Field} from './Field'
import {nativeTaichi, NativeTaichiAny} from "../native/taichi/GetTaichi"


function product(dimensions: number[]){
    let size = 1
    for (let d of dimensions) {
        size = size * d
    }
    return size
}

class SNodeTree {
    treeId: number = 0
    fields: Field[] = []
    size: number = 0
    nativeTreeRoot: NativeTaichiAny
    constructor(){
        this.nativeTreeRoot = new nativeTaichi.SNode(0, nativeTaichi.SNodeType.root);
    }

    addNaiveDenseField(elementSize:number, dimensions: number[]): Field{
        let totalSize = elementSize * product(dimensions)
        let field:Field = {
            snodeTree: this,
            offset: this.size,
            size: totalSize
        }
        this.size += totalSize
        this.fields.push(field)

        return field
    }
}

export {SNodeTree}