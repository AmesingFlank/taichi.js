//@ts-nocheck  

let simpleGraphicsExample = async (htmlCanvas:HTMLCanvasElement) => {
    await ti.init() 
    
    let VBO = ti.field(ti.types.vector(ti.f32, 3), 8)
    let IBO = ti.field(ti.i32, 36)
    //let target = ti.texture(ti.f32, 4, [1024,1024])
    let target = ti.canvasTexture(htmlCanvas) 
     
    ti.addToKernelScope({VBO, target, IBO})

    await VBO.fromArray([[0,0,0],[0,0,1],[0,1,0],[0,1,1],[1,0,0],[1,0,1],[1,1,0],[1,1,1]])
    await IBO.fromArray([
        0,1,2,
        1,3,2,
        4,5,6,
        4,7,6,
        0,2,4,
        2,6,4,
        1,3,5,
        3,7,5,
        0,1,4,
        1,5,4,
        2,3,6,
        3,7,6
    ])
    
    let pipeline = ti.kernel(
        () => { 
            let view = ti.lookAt([0.5,0.5,-2] , [0.5,0.5,0.5], [0.0, 1.0, 0.0])
            let proj = ti.perspective(45.0 , 2.0, 0.1, 100)
            let mvp = proj.matmul(view) 
            for(let v of ti.input_vertices(VBO, IBO)){
                let pos = mvp.matmul((v, 1.0)) 
                ti.output_position(pos)
                ti.output_vertex(v)
            }
            for(let f of ti.input_fragments()){
                let color = (f, 1.0)
                ti.output_color(target, color)
            }
        }
    )
    pipeline()
     
}

export {simpleGraphicsExample}