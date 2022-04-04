
import { taichiExample6Fractal } from './examples/taichi6_fractal/main'
import { taichiExample7VortexRing } from './examples/taichi7_vortex_ring/main'
import { simpleGraphicsExample } from './examples/graphics_simple/main'

import { Canvas } from "./ui/Canvas"

import { runAllTests } from "./tests/All"

import { init } from './api/Init'
import { addToKernelScope, clearKernelScope, kernel, func, i32, f32, sync, template } from './api/Lang'
import { field, Vector, Matrix, Struct, texture, canvasTexture, depthTexture } from "./api/Fields"
import { range, ndrange } from "./api/KernelScopeBuiltin"
import { types } from './api/Types'
import { clothExample } from './examples/cloth/main'

const ti = {

    taichiExample6Fractal,
    taichiExample7VortexRing,
    simpleGraphicsExample,
    clothExample,

    runAllTests,

    init,
    kernel, func, template,
    addToKernelScope, clearKernelScope,
    field, Vector, Matrix, Struct, 
    texture , canvasTexture, depthTexture,
    i32, f32,
    range, ndrange,
    sync,
    types,

    Canvas
}

export { ti }

// declare module globalThis {
//     let ti: any;
// }

// globalThis.ti = ti;