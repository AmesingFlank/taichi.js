
import {taichi} from './taichi'

declare module globalThis {
    let taichi: any;
}

globalThis.taichi = taichi;