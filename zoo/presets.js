let fractal = `
await ti.init() 

let n = 320

let pixels = ti.Vector.field(4, ti.f32,[2*n, n])

let complex_sqr = (z) => {
    return [z[0]**2 - z[1]**2, z[1] * z[0] * 2]
} 

ti.addToKernelScope({pixels, n, complex_sqr}) 

let kernel = ti.kernel(
    (t) => {
        //@ts-ignore
        for(let I of ndrange(n*2,n)){
            let i = I[0]
            let j = I[1]
            let c = [-0.8, cos(t) * 0.2]
            let z = [i / n - 1, j / n - 0.5] * 2
            let iterations = 0
            while( z.norm() < 20 && iterations < 50 ){
                z = complex_sqr(z) + c
                iterations = iterations + 1
            }
            pixels[i,j] = 1 - iterations * 0.02
            pixels[i,j][3] = 1
        }
    }
)

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = 2*n
htmlCanvas.height = n
let canvas = new ti.Canvas(htmlCanvas)

let i = 0
async function frame() {
    kernel(i * 0.03)
    i = i + 1
    canvas.setImage(pixels)
    requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
`

let vortex_ring = `
await ti.init() 

let resolution = [720,360]

let eps = 0.01
let dt = 0.1 

let n_vortex = 4
let n_tracer = 200000

let image = ti.Vector.field(4, ti.f32, resolution)
let pos = ti.Vector.field(2, ti.f32, n_vortex)
let new_pos = ti.Vector.field(2, ti.f32, n_vortex)
let vort = ti.field(ti.f32, n_vortex)
let tracer = ti.Vector.field(2, ti.f32, n_tracer)
 

let compute_u_single = (p, i) => {
    let r2 = (p - pos[i]).norm_sqr()
    let uv = [pos[i].y - p.y, p.x - pos[i].x]
    return vort[i] * uv / (r2 * Math.PI) * 0.5 * (1.0 - exp(-r2 / eps**2))
}
    
let compute_u_full = (p) => {
    let u = [0.0, 0.0]
    for(let i of range(n_vortex)){
        u = u + compute_u_single(p, i)
    }
    return u
}

ti.addToKernelScope({
    resolution, eps, dt, n_vortex, n_tracer, image,pos,
    new_pos,vort,tracer,compute_u_single,compute_u_full
})
    
let integrate_vortex = ti.kernel(
    () => {
        for(let i of range(n_vortex)){
            let v = [0.0,0.0]
            for(let j of range(n_vortex)){
                if(i!=j){
                    v = v + compute_u_single(pos[i], j)
                }
            }
            new_pos[i] = pos[i] + dt *  v
        }
        for(let i of range(n_vortex)) {
            pos[i] = new_pos[i]
        }
    }
)

let advect = ti.kernel(
    () => {
        for(let i of range(n_tracer)){
            let p = tracer[i]
            let v1 = compute_u_full(p)
            let v2 = compute_u_full(p + v1 * dt * 0.5)
            let v3 = compute_u_full(p + v2 * dt * 0.75)
            tracer[i] = p + (2 / 9 * v1 + 1 / 3 * v2 + 4 / 9 * v3) * dt
        }
    }
)

let init_tracers = ti.kernel(
    () => {
        pos[0] = [0.0, 1.0]
        pos[1] = [0.0, -1.0]
        pos[2] = [0.0, 0.3]
        pos[3] = [0.0, -0.3]
        vort[0] = 1.0
        vort[1] = -1.0
        vort[2] = 1.0
        vort[3] = -1.0
        for(let i of range(n_tracer)){
            let numX = 258 
            let numY = 3*numX
            let x = i32(i % numX)
            let y = i32((i - x)/ numX)
            tracer[i] = [x/numX - 0.5, (y/numY)*3 - 1.5]
        }
    }
)

let paint = ti.kernel(
    () => {
        for(let I of ndrange(resolution[0], resolution[1])){
            let i = I[0]
            let j = I[1]
            image[i,j] = [1.0,1.0,1.0,1.0]
        }
        for(let i of range(n_tracer)){
            let p = tracer[i] * [0.05,0.1] + [0.0,0.5]
            p[0] = p[0] * resolution[0]
            p[1] = p[1] * resolution[1]
            let ipos = i32(p)
            image[ipos] =  [0.0,0.0,0.0,1.0]
        }
    }
)

init_tracers() 
paint() 

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = resolution[0]
htmlCanvas.height = resolution[1]
let canvas = new ti.Canvas(htmlCanvas)

let tick = async () => {
    for(let i = 0; i< 4; ++i){
        advect()
        integrate_vortex()
    }
    paint()
    canvas.setImage(image)
    requestAnimationFrame(frame)
}

async function frame() {
    await tick()
}
requestAnimationFrame(frame)
`

export {fractal, vortex_ring}