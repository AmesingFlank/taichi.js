import {triangle} from './examples/triangle/main'
import {computeBoids} from './examples/computeBoids/main'
import {runTaichiProgram} from './examples/taichi/main'
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