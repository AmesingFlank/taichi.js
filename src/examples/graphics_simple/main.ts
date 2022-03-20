//@ts-nocheck 

let simpleGraphicsExample = async (htmlCanvas:HTMLCanvasElement) => {
    let Vertex = ti.types.struct({
        pos: ti.types.vector(ti.f32, 3)
    })
    
    let VBO = ti.field(Vertex, 100)
    let target = ti.texture(ti.f32, 4, [1024,1024])
    
    ti.addToKernelScope({VBO})
    
    let pipeline = ti.kernel(
        () => {
            for(let v of ti.vertex_input(VBO)){
                ti.vertex_output(v)
            }
            for(let f of ti.fragment_input()){
                ti.fragment_output(target, f.pos.xyzx)
            }
        }
    )
     
}

export {simpleGraphicsExample}