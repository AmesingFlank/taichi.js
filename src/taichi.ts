import {triangle} from './webgpu/triangle/main'
function kernel(f:any){
    console.log(f.toString())
}

const taichi = {
    kernel,
    triangle
}

export {taichi}