import type {SNodeTree} from './SNodeTree'
import {NativeTaichiAny, nativeTaichi} from "../native/taichi/GetTaichi"
class Field {
    snodeTree: SNodeTree|null = null
    offset: number = 0
    size: number = 0
    placeNode: NativeTaichiAny
}

export {Field}