import {triangle} from './examples/triangle/main'
import {computeBoids} from './examples/computeBoids/main'
import {taichiExample0} from './examples/taichi0/main'
import {taichiExample1} from './examples/taichi1/main'
import {taichiExample2VortexRing} from './examples/taichi2_vortex_ring/main'
import {taichiExample3VortexRingSpv} from './examples/taichi3_vortex_ring_spv/main'
import {taichiExample4} from './examples/taichi4/main'
import {taichiExample5} from './examples/taichi5/main'
import {typecheckerExample0} from './examples/compiler_api/typechecker0'

import {runAllTests} from "./tests/All"

import { init } from './api/Init'
import { addToKernelScope, kernel, i32, f32 } from './api/Lang'
import { field, Vector, Matrix } from "./program/FieldsFactory"
import {range,ndrange} from "./api/KernelScopeBuiltin"

const ti = {
    triangle,
    computeBoids,
    taichiExample0,
    taichiExample1,
    taichiExample2VortexRing,
    taichiExample3VortexRingSpv,
    taichiExample4,
    taichiExample5,
    typecheckerExample0,

    runAllTests,

    init,
    kernel,
    addToKernelScope,
    field,Vector,Matrix,
    i32,f32,
    range,ndrange
}

export {ti}

declare module globalThis {
    let ti: any;
}

globalThis.ti = ti;