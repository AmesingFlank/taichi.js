
// The implementations in this file only serve as documentation of their behavior, and for generating type declarations
// These implementations are not actually used

import { TextureBase } from "../data/Texture"

export function range(n: number): number[] {
    let result: number[] = []
    for (let i = 0; i < n; ++i) {
        result.push(i)
    }
    return result
}

export function ndrange(...args: number[]): number[][] {
    if (args.length === 0) {
        return [[]]
    }
    let rec = ndrange(...args.slice(1,))
    let n = args[0]
    let result: number[][] = []
    for (let i = 0; i < n; ++i) {
        for (let arr of rec) {
            result.push([i].concat(arr))
        }
    }
    return result
}

export function textureStore(texture: TextureBase, coords: number[], value: number[]) {

}
