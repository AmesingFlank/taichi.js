
// The implementations in this file only serve as documentation of their behavior, and for generating type declarations
// These implementations are not actually used

import { TextureBase } from "../data/Texture"
import { assert, error } from "../utils/Logging"

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

function broadCastableMathOp(a: number[] | number, b: number[] | number, op: (a: number, b: number) => number): number[] | number {
    if (typeof a === "number" && typeof b === "number") {
        return op(a, b)
    }
    if (Array.isArray(a) && typeof b === "number") {
        return a.map(x => op(x, b))
    }
    if (typeof a === "number" && Array.isArray(b)) {
        return b.map(x => op(a, x))
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        assert(a.length === b.length, "vector size mismatch")
        let result: number[] = []
        for (let i = 0; i < a.length; ++i) {
            result.push(op(a[i], b[i]))
        }
        return result
    }
    error("unsupported arguments")
    return 0.0
}

export function neg(a: number[] | number): number[] | number {
    if(typeof a === "number"){
        return -a
    }
    else{
        return a.map(x => -x)
    }
}

export function add(a: number[] | number, b: number[] | number): number[] | number {
    return broadCastableMathOp(a, b, (a: number, b: number) => a + b)
}

export function sub(a: number[] | number, b: number[] | number): number[] | number {
    return broadCastableMathOp(a, b, (a: number, b: number) => a - b)
}

export function mul(a: number[] | number, b: number[] | number): number[] | number {
    return broadCastableMathOp(a, b, (a: number, b: number) => a * b)
}

export function div(a: number[] | number, b: number[] | number): number[] | number {
    return broadCastableMathOp(a, b, (a: number, b: number) => a / b)
}

export function norm_sqr(v: number[]): number {
    let result = 0
    for (let x of v) {
        result += x * x
    }
    return result
}

export function norm(v: number[]): number {
    return Math.sqrt(norm_sqr(v))
}

export function normalized(v: number[]): number[] {
    return div(v, norm(v)) as number[]
}

export function dot(a: number[], b: number[]): number {
    assert(a.length === b.length, "vector size mismatch")
    let sum = 0
    for (let i = 0; i < a.length; ++i) {
        sum += a[i] * b[i]
    }
    return sum
}

export function cross(a: number[], b: number[]): number[] {
    assert(a.length === 3 && b.length === 3, "vector size must be 3")
    let result = [0, 0, 0]
    result[0] = a[1] * b[2] - a[2] * b[1]
    result[1] = a[2] * b[0] - a[0] * b[2]
    result[2] = a[0] * b[1] - a[1] * b[0]
    return result
}

export function matmul(a: number[][], b: number[][] | number[]): number[][] | number[] {
    if (Array.isArray(b[0])) {
        b = b as number[][]
        let result: number[][] = []
        assert(a[0].length === b.length, "matrix size mismatch")
        for (let i = 0; i < a.length; ++i) {
            let row = []
            for (let j = 0; j < b[0].length; ++j) {
                let e = 0
                for (let k = 0; k < a[0].length; ++k) {
                    e += a[i][k] * b[k][j]
                }
                row.push(e)
            }
            result.push(row)
        }
        return result
    }
    else {
        let result: number[] = []
        b = b as number[]
        assert(a[0].length === b.length, "matrix size mismatch")
        for (let i = 0; i < a.length; ++i) {
            let e = 0
            for (let j = 0; j < b.length; ++j) {
                e += a[i][j] + b[j]
            }
            result.push(e)
        }
        return result
    }
}
