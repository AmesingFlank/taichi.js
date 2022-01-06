import {getTintModule} from '../../tint/getTint' 

import {shader as init_tracers_0} from './init_tracers_c60_0_k0005_vk_t00'
import {shader as init_tracers_1} from './init_tracers_c60_0_k0005_vk_t01'
import {shader as advect_0} from './advect_c58_0_k0006_vk_t00'
import {shader as integrate_vortex_0} from './integrate_vortex_c56_0_k0007_vk_t00'
import {shader as integrate_vortex_1} from './integrate_vortex_c56_0_k0007_vk_t01'
import {shader as paint_0} from './paint_c60_0_k0008_vk_t00'
import {shader as paint_1} from './paint_c60_0_k0008_vk_t01'

import {program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../program/FieldsFactory'

let taichiExample3VortexRingSpv = async (canvas:HTMLCanvasElement) => {
    let tint = await getTintModule()
    let spvToWgsl = tint.tintSpvToWgsl
    await program.materializeRuntime()

    let resolution = [512,1024]
    let n_vortex = 4
    let n_tracer = 200000
    let image = Vector.field(4,  resolution)
    let pos = Vector.field(2,  [n_vortex])
    let new_pos = Vector.field(2,  [n_vortex])
    let vort = field( [n_vortex])
    let tracer = Vector.field(2,  [n_tracer])

    program.materializeCurrentTree()


    let initTracersKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(init_tracers_0),
            invocatoions: 1
        },
        {
            code: spvToWgsl(init_tracers_1),
            invocatoions: n_tracer
        }
    ])
    let advectKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(advect_0),
            invocatoions: n_tracer
        }
    ])
    let integrateVortexKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(integrate_vortex_0),
            invocatoions: n_vortex
        },
        {
            code: spvToWgsl(integrate_vortex_1),
            invocatoions: n_vortex
        }
    ])
    let paintKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(paint_0),
            invocatoions: resolution[0] * resolution[1]
        },
        {
            code: spvToWgsl(paint_1),
            invocatoions: resolution[0] * resolution[1]
        }
    ])

    let renderer = await program.runtime!.getRootBufferRenderer(canvas)
    program.runtime!.launchKernel(initTracersKernel)

    async function frame() {
        for(let i = 0; i<4;++i){
            program.runtime!.launchKernel(advectKernel)
            program.runtime!.launchKernel(integrateVortexKernel)
        }
        program.runtime!.launchKernel(paintKernel)
        await program.runtime!.sync()
        await renderer.render(1024,512)
        console.log("done")
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    
    
}

export {taichiExample3VortexRingSpv}