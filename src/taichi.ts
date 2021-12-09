import {triangle} from './examples/triangle/main'
import {computeBoids} from './examples/computeBoids/main'
import {taichiExample0} from './examples/taichi0/main'
import {taichiExample1} from './examples/taichi1/main'

function kernel(f:any){
    console.log(f.toString())
}

const taichi = {
    kernel,
    triangle,
    computeBoids,
    taichiExample0,
    taichiExample1
}

export {taichi}