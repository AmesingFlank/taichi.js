
import { Canvas } from "./api/ui/Canvas"

import { runAllTests } from "./tests/All"

import { init } from './api/Init'
import { addToKernelScope, clearKernelScope, kernel, func, i32, f32, sync, template, classKernel } from './api/Kernels'
import { field, Vector, Matrix, Struct, } from "./api/Fields"
import { texture, canvasTexture, depthTexture, Texture, CubeTexture } from "./api/Textures"
import { range, ndrange } from "./api/KernelScopeBuiltin"
import { types } from './api/Types'
import * as utils from "./api/Utils/index"

export {

    runAllTests,

    init,
    kernel, classKernel, func, template,
    addToKernelScope, clearKernelScope,
    field, Vector, Matrix, Struct,
    texture, canvasTexture, depthTexture, Texture, CubeTexture,
    i32, f32,
    range, ndrange,
    sync,
    types,

    utils,

    Canvas
}
declare module globalThis {
    let ti: any;
}

globalThis.ti = {
    runAllTests,

    init,
    kernel, classKernel, func, template,
    addToKernelScope, clearKernelScope,
    field, Vector, Matrix, Struct,
    texture, canvasTexture, depthTexture, Texture, CubeTexture,
    i32, f32,
    range, ndrange,
    sync,
    types,

    utils,

    Canvas
}