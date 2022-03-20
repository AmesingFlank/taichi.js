//@ts-nocheck
import {ti} from "../../taichi" 

let simpleGraphicsExample = async (htmlCanvas:HTMLCanvasElement) => {
    let Vertex = ti.types.struct({
        pos: ti.types.vector(ti.f32, 3)
    })
    
    let VBO = ti.field(Vertex, 100)
    
    ti.addToKernelScope({VBO})
    
    let pipeline = ti.graphics_pipeline(
        () => {
            for(let v of ti.vertex_input(VBO)){
                ti.vertex_output(v)
            }
            for(let f of ti.fragment_input()){
                ti.fragment_output(f.pos.xyzx)
            }
        }
    )
     
}

export {simpleGraphicsExample}