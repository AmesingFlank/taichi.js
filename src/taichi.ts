import {triangle} from './webgpu/triangle/main'
import {computeBoids} from './webgpu/computeBoids/main'
import {runTaichiProgram} from './webgpu/taichi/main'
function kernel(f:any){
    console.log(f.toString())
}

const taichi = {
    kernel,
    triangle,
    computeBoids,
    runTaichiProgram
}

export {taichi}