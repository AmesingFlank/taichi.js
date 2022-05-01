import { assert } from "../utils/Logging"

export function add(a:number[], b:number[]) : number[] {
    assert(a.length === b.length, "vector size mismatch")
    let result:number[] = []
    for(let i = 0;i<a.length;++i){
        result.push(a[i] + b[i])
    }
    return result
}

export function sub(a:number[], b:number[]) : number[] {
    assert(a.length === b.length, "vector size mismatch")
    let result:number[] = []
    for(let i = 0;i<a.length;++i){
        result.push(a[i] - b[i])
    }
    return result
}

export function dot(a:number[], b:number[]) : number {
    assert(a.length === b.length, "vector size mismatch")
    let sum = 0
    for(let i = 0; i < a.length;++i){
        sum += a[i] * b[i]
    }
    return sum
}

export function cross(a:number[], b:number[]) : number[] {
    assert(a.length === 3 && b.length === 3, "vector size must be 3")
    let result = [0,0,0]
    result[0] = a[1] * b[2] - a[2] * b[1]
    result[1] = a[2] * b[0] - a[0] * b[2]
    result[2] = a[0] * b[1] - a[1] * b[0]
    return result
}

export function matmul(a:number[][], b:number[][] | number[]) : number[][] | number[]{
    if(Array.isArray(b[0])){
        b = b as number[][]
        let result:number[][] = []
        assert(a[0].length === b.length, "matrix size mismatch")
        for(let i = 0; i < a.length ; ++i){
            let row = []
            for(let j = 0; j < b[0].length;++j){
                let e = 0
                for(let k = 0; k < a[0].length;++k){
                    e += a[i][k] * b[k][j]
                }
                row.push(e)
            }
            result.push(row)
        }
        return result
    }
    else{
        let result:number[] = []
        b = b as number[]
        assert(a[0].length === b.length, "matrix size mismatch")
        for(let i = 0; i < a.length ; ++i){
            let e = 0
            for(let j = 0; j < b.length;++j){
                e += a[i][j] + b[j]
            }
            result.push(e)
        }
        return result
    }
}
