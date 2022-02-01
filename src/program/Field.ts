import type {SNodeTree} from './SNodeTree'
import {NativeTaichiAny, nativeTaichi} from "../native/taichi/GetTaichi"
import {PrimitiveType, Type} from "../frontend/Type"
class Field {
    constructor(
        public snodeTree: SNodeTree ,
        public offset: number  ,
        public size: number,
        public dimensions: number[],
        public placeNodes: NativeTaichiAny[],
        public elementType:Type
    ){

    }

    // No need to call aot.add_field
    // private addedToAotBuilder: boolean = false
    // public name: string|null = null

    // addToAotBuilder(builder: NativeTaichiAny, name: string){
    //     console.log("addingToAOT")
    //     if(this.addedToAotBuilder){
    //         return
    //     }
    //     this.name = name

    //     let dimensions : NativeTaichiAny = new nativeTaichi.VectorOfInt()
    //     for(let d of this.dimensions){
    //         dimensions.push_back(d)
    //     }
    //     builder.add_field("place", this.placeNode, this.isScalar, this.placeNode.dt_get(), dimensions, this.numRows, this.numCols);
    //     this.addedToAotBuilder = true
    // }
}

export {Field}