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

function product(arr: number[]){
    let result = 1
    for(let d of arr){
        result *= d
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

    addNaiveDenseField(elementSize:number, numRows:number, numCols:number, dimensions: number[]): Field{

        let axisVec : NativeTaichiAny = new nativeTaichi.VectorOfAxis()
        let sizesVec: NativeTaichiAny = new nativeTaichi.VectorOfInt()
        for(let i = 0; i < dimensions.length; ++ i){
            axisVec.push_back(new nativeTaichi.Axis(i))
            sizesVec.push_back(dimensions[i])
        }
        
        let dense = this.nativeTreeRoot.dense(axisVec,sizesVec, false);

        let placeNodes: NativeTaichiAny[] = []
        for(let i = 0;i<numCols * numRows; ++i){
            let place = dense.insert_children(nativeTaichi.SNodeType.place);
            place.dt_set(nativeTaichi.PrimitiveType.i32) 
            placeNodes.push(place)
        }

        let totalSize = elementSize * numElements(dimensions)
        let field = new Field(this,this.size, totalSize, dimensions, placeNodes, true, numRows,numCols)
        
        this.size += totalSize
        this.fields.push(field)

        return field
    }
}

export {SNodeTree}