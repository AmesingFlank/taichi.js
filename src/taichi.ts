
import { taichiExample6Fractal } from './examples/taichi6_fractal/main'
import { taichiExample7VortexRing } from './examples/taichi7_vortex_ring/main'
import { Canvas } from "./ui/Canvas"

import { runAllTests } from "./tests/All"

import { init } from './api/Init'
import { addToKernelScope, kernel, func, i32, f32, sync } from './api/Lang'
import { field, Vector, Matrix } from "./api/Fields"
import { range, ndrange } from "./api/KernelScopeBuiltin"
import { types } from './api/Types'

const ti = {

    taichiExample6Fractal,
    taichiExample7VortexRing,

    runAllTests,

    init,
    kernel, func,
    addToKernelScope,
    field, Vector, Matrix,
    i32, f32,
    range, ndrange,
    sync,
    types,

    Canvas
}

export { ti }

declare module globalThis {
    let ti: any;
}

globalThis.ti = ti;