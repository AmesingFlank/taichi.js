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
 
const taichi = {
    triangle,
    computeBoids,
    taichiExample0,
    taichiExample1,
    taichiExample2VortexRing,
    taichiExample3VortexRingSpv,
    taichiExample4,
    taichiExample5,
    typecheckerExample0,
    runAllTests
}

export {taichi}

declare module globalThis {
    let taichi: any;
}

globalThis.taichi = taichi;