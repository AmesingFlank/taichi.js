import type {SNodeTree} from './SNodeTree'
import {NativeTaichiAny, nativeTaichi} from "../native/taichi/GetTaichi"
import {PrimitiveType, Type} from "../frontend/Type"
import {Program} from "./Program"
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

    async toArray1D() : Promise<number[]>{
        return Program.getCurrentProgram().runtime!.copyFieldToHost(this);
    }
}

export {Field}