//@ts-nocheck  

let simpleGraphicsExample = async (htmlCanvas:HTMLCanvasElement) => {
    await ti.init() 
    
    let VBO = ti.field(ti.types.vector(ti.f32, 2), 4)
    let IBO = ti.field(ti.i32, 6)
    //let target = ti.texture(ti.f32, 4, [1024,1024])
    let target = ti.canvasTexture(htmlCanvas) 
     
    ti.addToKernelScope({VBO, target, IBO})

    await VBO.fromArray([[-1,-1], [1,-1], [-1,1], [1,1]])
    await IBO.fromArray([0,1,2,1,3,2])
    
    let pipeline = ti.kernel(
        () => { 
            for(let v of ti.input_vertices(VBO, IBO)){
                ti.output_vertex((v.xy + 1) / 2)
                let pos = [v.x, v.y, 0.0,1.0]
                ti.output_position(pos)
            }
            for(let f of ti.input_fragments()){
                let color = [f.x, f.y, 0.0,1.0]
                ti.output_color(target, color)
            }
        }
    )
    pipeline()
     
}

export {simpleGraphicsExample}