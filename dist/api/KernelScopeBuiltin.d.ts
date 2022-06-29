import { DepthTexture, TextureBase } from "../data/Texture";
import * as ti from "../taichi";
import { Field } from "../data/Field";
export declare function range(n: number): number[];
export declare function ndrange(...args: number[]): ti.types.vector[];
export declare function inputVertices(vertexBuffer: Field, indexBuffer?: Field, indirectBuffer?: Field, indirectCount?: number): any[];
export declare function inputFragments(): any[];
export declare function neg(a: number | ti.types.vector): number | ti.types.vector;
export declare function add(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector;
export declare function sub(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector;
export declare function mul(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector;
export declare function div(a: number | ti.types.vector, b: number | ti.types.vector): number | ti.types.vector;
export declare function norm_sqr(v: ti.types.vector): number;
export declare function norm(v: ti.types.vector): number;
export declare function normalized(v: ti.types.vector): ti.types.vector;
export declare function dot(a: ti.types.vector, b: ti.types.vector): number;
export declare function cross(a: ti.types.vector, b: ti.types.vector): ti.types.vector;
export declare function matmul(a: ti.types.matrix | ti.types.vector, b: ti.types.vector): ti.types.matrix | ti.types.vector;
export declare function transpose(m: ti.types.matrix): ti.types.matrix;
export declare function inverse(m: ti.types.matrix): ti.types.matrix;
export declare function polarDecompose2D(A: ti.types.matrix): {
    U: number[][];
    P: any;
};
export declare function outputVertex(vertex: any): void;
export declare function outputPosition(pos: any): void;
export declare function clearColor(tex: TextureBase, col: any): void;
export declare function useDepth(depth: DepthTexture): void;
export declare function outputColor(tex: TextureBase, col: any): void;
export declare function outputDepth(depth: number): void;
export declare function discard(): void;
export declare function textureSample(texture: TextureBase, coords: any): any;
export declare function textureSampleLod(texture: TextureBase, coords: any, lod: number): number[];
export declare function textureLoad(texture: TextureBase, coords: any): number[];
export declare function textureStore(texture: TextureBase, coords: any, val: any): void;
export declare function getVertexIndex(): number;
export declare function getInstanceIndex(): number;
export declare function dpdx(val: number | ti.types.vector): number | ti.types.vector;
export declare function dpdy(val: number | ti.types.vector): number | ti.types.vector;
export declare function lookAt(eye: ti.types.vector, center: ti.types.vector, up: ti.types.vector): any[];
export declare function perspective(fovy: number, aspect: number, zNear: number, zFar: number): number[][];
export declare function ortho(left: number, right: number, bottom: number, top: number, zNear: number, zFar: number): number[][];
export declare function rotateAxisAngle(axis: ti.types.vector, angle: number): ti.types.matrix;
export declare function translate(t: ti.types.vector): ti.types.matrix;
export declare function scale(t: ti.types.vector): ti.types.matrix;
export declare function mergeStructs(a: ti.types.struct, b: ti.types.struct): ti.types.struct;
export declare function bitcast_i32(number: number | ti.types.vector): number | ti.types.vector;
export declare function bitcast_f32(number: number | ti.types.vector): number | ti.types.vector;
export declare function not(number: number | ti.types.vector): number | ti.types.vector;
export declare function rsqrt(number: number | ti.types.vector): number | ti.types.vector;
