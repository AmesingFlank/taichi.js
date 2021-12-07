import {triangle} from './webgpu/triangle/main'
import {computeBoids} from './webgpu/computeBoids/main'
function kernel(f:any){
    console.log(f.toString())
}

const taichi = {
    kernel,
    triangle,
    computeBoids
}

export {taichi}