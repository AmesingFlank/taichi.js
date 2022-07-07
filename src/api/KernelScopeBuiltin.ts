
// The implementations in this file only serve as documentation of their behavior, and for generating type declarations
// These implementations are not actually used

import { DepthTexture, TextureBase } from "../data/Texture"
import { assert, error } from "../utils/Logging"
import * as ti from "../taichi"
import { Field } from "../data/Field"

let throwNotImplementedError = () => {
    error("This function is only implemented in taichi kernel scope!")
}

export function range(n: number): number[] {
    let result: number[] = []
    for (let i = 0; i < n; ++i) {
        result.push(i)
    }
    return result
}

export function ndrange(...args: number[]): ti.types.vector[] {
    if (args.length === 0) {
        return [[]]
    }
    let rec = ndrange(...args.slice(1,))
    let n = args[0]
    let result: any = []
    for (let i = 0; i < n; ++i) {
        for (let arr of rec) {
            result.push([i].concat(arr))
        }
    }
    return result
}

export function inputVertices(vertexBuffer: Field, indexBuffer?: Field, indirectBuffer?: Field, indirectCount?: number): any[] {
    throwNotImplementedError()
    return []
}

export function inputFragments(): any[] {
    throwNotImplementedError()
    return []
}

function broadCastableMathOp(a: number | ti.types.vector, b: number | ti.types.vector, op: (a: number, b: number) => number): number | ti.types.vector {
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
        let result: any = []
        for (let i = 0; i < a.length; ++i) {
            result.push(op(a[i], b[i]))
        }
        return result
    }
    error("unsupported arguments")
    return 0.0
}

export function neg(a: number | ti.types.vector): number | ti.types.vector {
    if (typeof a === "number") {
        return -a
    }
    else {
        return a.map((x: number) => -x)
    }
}

export function add(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector {
    return broadCastableMathOp(a, b, (a: number, b: number) => a + b)
}

export function sub(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector {
    return broadCastableMathOp(a, b, (a: number, b: number) => a - b)
}

export function mul(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector {
    return broadCastableMathOp(a, b, (a: number, b: number) => a * b)
}

export function div(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector {
    return broadCastableMathOp(a, b, (a: number, b: number) => a / b)
}

export function norm_sqr(v: ti.types.vector): number {
    let result = 0
    for (let x of v) {
        result += x * x
    }
    return result
}

export function norm(v: ti.types.vector): number {
    return Math.sqrt(norm_sqr(v))
}

export function normalized(v: ti.types.vector): ti.types.vector {
    return div(v, norm(v)) as ti.types.vector
}

export function dot(a: ti.types.vector, b: ti.types.vector): number {
    assert(a.length === b.length, "vector size mismatch")
    let sum = 0
    for (let i = 0; i < a.length; ++i) {
        sum += a[i] * b[i]
    }
    return sum
}

export function cross(a: ti.types.vector, b: ti.types.vector): ti.types.vector {
    assert(a.length === 3 && b.length === 3, "vector size must be 3")
    let result = [0, 0, 0]
    result[0] = a[1] * b[2] - a[2] * b[1]
    result[1] = a[2] * b[0] - a[0] * b[2]
    result[2] = a[0] * b[1] - a[1] * b[0]
    return result
}

export function matmul(a: ti.types.matrix | ti.types.vector, b: ti.types.vector): ti.types.matrix | ti.types.vector {
    if (Array.isArray(b[0])) {
        b = b as ti.types.matrix
        let result: any = []
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
        let result: any = []
        b = b as ti.types.vector
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


export function transpose(m: ti.types.matrix): ti.types.matrix {
    let R = m.length
    let C = m[0].length

    let result: any = []
    for (let c = 0; c < C; ++c) {
        let thisRow: any = []
        for (let r = 0; r < R; ++r) {
            thisRow.push(m[r][c])
        }
        result.push(thisRow)
    }
    return result
}

export function inverse(m: ti.types.matrix): ti.types.matrix {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[2][1] * m[1][2]) -
        m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
        m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

    let invdet = 1 / det;

    let minv = [
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
    ];
    minv[0][0] = (m[1][1] * m[2][2] - m[2][1] * m[1][2]) * invdet;
    minv[0][1] = (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet;
    minv[0][2] = (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet;
    minv[1][0] = (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet;
    minv[1][1] = (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet;
    minv[1][2] = (m[1][0] * m[0][2] - m[0][0] * m[1][2]) * invdet;
    minv[2][0] = (m[1][0] * m[2][1] - m[2][0] * m[1][1]) * invdet;
    minv[2][1] = (m[2][0] * m[0][1] - m[0][0] * m[2][1]) * invdet;
    minv[2][2] = (m[0][0] * m[1][1] - m[1][0] * m[0][1]) * invdet;
    return minv;
}

export function polarDecompose2D(A: ti.types.matrix) {
    let x = A[0][0] + A[1][1]
    let y = A[1][0] - A[0][1]
    let scale = 1.0 / Math.sqrt(x * x + y * y)
    let c = x * scale
    let s = y * scale
    let r = [[c, -s], [s, c]]
    return {
        U: r,
        P: ti.matmul(ti.transpose(r), A)
    }
}

export function outputVertex(vertex: any) { throwNotImplementedError() }
export function outputPosition(pos: any) { throwNotImplementedError() }
export function clearColor(tex: TextureBase, col: any) { throwNotImplementedError() }
export function useDepth(depth: DepthTexture) { throwNotImplementedError() }
export function outputColor(tex: TextureBase, col: any) { throwNotImplementedError() }
export function outputDepth(depth: number) { throwNotImplementedError() }
export function discard() { throwNotImplementedError() }

export function textureSample(texture: TextureBase, coords: any): any { throwNotImplementedError(); return [0.0, 0.0, 0.0, 0.0] }
export function textureSampleLod(texture: TextureBase, coords: any, lod: number) { throwNotImplementedError(); return [0.0, 0.0, 0.0, 0.0] }
export function textureSampleCompare(texture: DepthTexture, coords: any, depthReference: number) { throwNotImplementedError(); return 0.0 }
export function textureLoad(texture: TextureBase, coords: any) { throwNotImplementedError(); return [0.0, 0.0, 0.0, 0.0] }
export function textureStore(texture: TextureBase, coords: any, val: any) { throwNotImplementedError(); }

export function getVertexIndex(): number { throwNotImplementedError(); return 0 }
export function getInstanceIndex(): number { throwNotImplementedError(); return 0 }
export function getFragCoord(): number[] { throwNotImplementedError(); return [0.0, 0.0, 0.0, 0.0] }

export function dpdx(val: number | ti.types.vector): number | ti.types.vector { throwNotImplementedError(); return 0 }
export function dpdy(val: number | ti.types.vector): number | ti.types.vector { throwNotImplementedError(); return 0 }


export function lookAt(eye: ti.types.vector, center: ti.types.vector, up: ti.types.vector) {
    let z = normalized(sub(eye, center) as ti.types.vector)
    let x = normalized(cross(up, z))
    let y = normalized(cross(z, x))
    let result = [
        x.concat([-dot(x, eye)]),
        y.concat([-dot(y, eye)]),
        z.concat([-dot(z, eye)]),
        [0, 0, 0, 1]
    ]
    return result
}

export function perspective(fovy: number, aspect: number, zNear: number, zFar: number) {
    let rad = fovy * Math.PI / 180.0
    let tanHalfFovy = Math.tan(rad / 2.0)

    let zero4 = [0.0, 0.0, 0.0, 0.0]
    let result = [zero4.slice(), zero4.slice(), zero4.slice(), zero4.slice()]

    result[0][0] = 1.0 / (aspect * tanHalfFovy)
    result[1][1] = 1.0 / (tanHalfFovy)
    result[2][2] = (zFar) / (zNear - zFar)
    result[3][2] = - 1.0
    result[2][3] = (zFar * zNear) / (zNear - zFar)
    return result;
}

export function ortho(left: number, right: number, bottom: number, top: number, zNear: number, zFar: number) {
    let zero4 = [0.0, 0.0, 0.0, 0.0]
    let result = [zero4.slice(), zero4.slice(), zero4.slice(), zero4.slice()]
    result[0][0] = 2.0 / (right - left);
    result[1][1] = 2.0 / (top - bottom);
    result[2][2] = - 1.0 / (zFar - zNear);
    result[0][3] = - (right + left) / (right - left);
    result[1][3] = - (top + bottom) / (top - bottom);
    result[2][3] = - (zNear) * 2.0 / (zFar - zNear);
    result[3][3] = 1.0
    return result
}

export function rotateAxisAngle(axis: ti.types.vector, angle: number): ti.types.matrix {
    let a = angle
    let c = Math.cos(a)
    let s = Math.sin(a)
    let temp: ti.types.vector = (1.0 - c) * axis

    let m = [
        [1.0, 0.0, 0.0, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ];
    m[0][0] = c + temp[0] * axis[0];
    m[1][0] = temp[0] * axis[1] + s * axis[2];
    m[2][0] = temp[0] * axis[2] - s * axis[1];

    m[0][1] = temp[1] * axis[0] - s * axis[2];
    m[1][1] = c + temp[1] * axis[1];
    m[2][1] = temp[1] * axis[2] + s * axis[0];

    m[0][2] = temp[2] * axis[0] + s * axis[1];
    m[1][2] = temp[2] * axis[1] - s * axis[0];
    m[2][2] = c + temp[2] * axis[2];
    return m
}

export function translate(t: ti.types.vector): ti.types.matrix {
    return [
        [1.0, 0.0, 0.0, t[0]],
        [0.0, 1.0, 0.0, t[1]],
        [0.0, 0.0, 1.0, t[2]],
        [0.0, 0.0, 0.0, 1.0],
    ];
}

export function scale(t: ti.types.vector): ti.types.matrix {
    return [
        [t[0], 0.0, 0.0, 0.0],
        [0.0, t[1], 0.0, 0.0],
        [0.0, 0.0, t[2], 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ];
}

export function mergeStructs(a: ti.types.struct, b: ti.types.struct): ti.types.struct {
    let result: ti.types.struct = {}
    for (let k in a) {
        result[k] = a[k]
    }
    for (let k in b) {
        result[k] = b[k]
    }
    return result
}

export function bitcast_i32(number: number | ti.types.vector): number | ti.types.vector {
    throwNotImplementedError();
    return number
}

export function bitcast_f32(number: number | ti.types.vector): number | ti.types.vector {
    throwNotImplementedError();
    return number
}

export function not(number: number | ti.types.vector): number | ti.types.vector {
    throwNotImplementedError();
    return number
}

export function rsqrt(number: number | ti.types.vector): number | ti.types.vector {
    throwNotImplementedError();
    return number
}
