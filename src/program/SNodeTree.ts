import {Field} from './Field'
import {nativeTaichi, NativeTaichiAny} from "../native/taichi/GetTaichi"
import {nextPowerOf2} from "../utils/Utils"


function numElements(dimensions: number[], packed:boolean = false){
    let result = 1
    for(let d of dimensions){
        if(packed){
            result *= d
        }
        else{
            result *= nextPowerOf2(d)
        }
    }
    return result
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

        // let dense = root.dense(new nativeTaichi.Axis(0), n, false);
        // console.log(dense)
        
        // let place = dense.insert_children(nativeTaichi.SNodeType.place);
        // console.log(place)
    
        // place.dt_set(nativeTaichi.PrimitiveType.i32)


        let totalSize = elementSize * numElements(dimensions)
        let field:Field = {
            snodeTree: this,
            offset: this.size,
            size: totalSize,
            placeNode: null
        }
        
        this.size += totalSize
        this.fields.push(field)

        return field
    }
}

export {SNodeTree}