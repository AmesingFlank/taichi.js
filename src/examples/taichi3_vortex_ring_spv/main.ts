import {nativeTint} from '../../native/tint/GetTint' 

import {shader as init_tracers_0} from './init_tracers_c60_0_k0005_vk_t00'
import {shader as init_tracers_1} from './init_tracers_c60_0_k0005_vk_t01'
import {shader as advect_0} from './advect_c58_0_k0006_vk_t00'
import {shader as integrate_vortex_0} from './integrate_vortex_c56_0_k0007_vk_t00'
import {shader as integrate_vortex_1} from './integrate_vortex_c56_0_k0007_vk_t01'
import {shader as paint_0} from './paint_c60_0_k0008_vk_t00'
import {shader as paint_1} from './paint_c60_0_k0008_vk_t01'

import {Program} from '../../program/Program'
import {field,Vector,Matrix}  from '../../api/Fields'
import {init} from '../../api/Init'
import {PrimitiveType} from "../../frontend/Type"
import {BufferType, BufferBinding} from "../../backend/Kernel"

let taichiExample3VortexRingSpv = async (canvas:HTMLCanvasElement) => {
    await init()

    let spvToWgsl = nativeTint.tintSpvToWgsl
    let program = Program.getCurrentProgram()
    await program.materializeRuntime()

    let resolution = [512,1024]
    let n_vortex = 4
    let n_tracer = 200000
    let image = Vector.field(4, PrimitiveType.f32,  resolution)
    let pos = Vector.field(2,PrimitiveType.f32,  [n_vortex])
    let new_pos = Vector.field(2,PrimitiveType.f32,  [n_vortex])
    let vort = field(PrimitiveType.f32, [n_vortex])
    let tracer = Vector.field(2,PrimitiveType.f32,  [n_tracer])

    program.materializeCurrentTree()

    let bindings = [new BufferBinding(BufferType.Root,0,0)]
    let initTracersKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(init_tracers_0),
            workgroupSize: 128,
            rangeHint:"1",
            bindings
        },
        {
            code: spvToWgsl(init_tracers_1),
            workgroupSize: 128,
            rangeHint:n_tracer.toString(),
            bindings
        }
    ])
    let advectKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(advect_0),
            workgroupSize: 128,
            rangeHint:n_tracer.toString(),
            bindings
        }
    ])
    let integrateVortexKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(integrate_vortex_0),
            workgroupSize: 128,
            rangeHint:n_vortex.toString(),
            bindings
        },
        {
            code: spvToWgsl(integrate_vortex_1),
            workgroupSize: 128,
            rangeHint:n_vortex.toString(),
            bindings
        }
    ])
    let paintKernel = program.runtime!.createKernel([
        {
            code: spvToWgsl(paint_0),
            workgroupSize: 128,
            rangeHint:(resolution[0] * resolution[1]).toString(),
            bindings
        },
        {
            code: spvToWgsl(paint_1),
            workgroupSize: 128,
            rangeHint:(resolution[0] * resolution[1]).toString(),
            bindings
        }
    ])

    let renderer = await program.runtime!.getRootBufferRenderer(canvas,image.snodeTree.treeId)
    program.runtime!.launchKernel(initTracersKernel)

    async function frame() {
        for(let i = 0; i<4;++i){
            program.runtime!.launchKernel(advectKernel)
            program.runtime!.launchKernel(integrateVortexKernel)
        }
        program.runtime!.launchKernel(paintKernel)
        await program.runtime!.sync()
        await renderer.render(1024,512)
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)

    
    
}

export {taichiExample3VortexRingSpv}