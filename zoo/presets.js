let fractal = 
`await ti.init() 

let n = 320
let pixels = ti.Vector.field(4, ti.f32,[2*n, n])

let complex_sqr = (z) => {
    return [z[0]**2 - z[1]**2, z[1] * z[0] * 2]
} 

ti.addToKernelScope({pixels, n, complex_sqr}) 

let kernel = ti.kernel(
    (t) => {
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

let fractal3D = 
`await ti.init() 

let quat_mul = (v1, v2) => [
    v1.x * v2.x - v1.y * v2.y - v1.z * v2.z - v1.w * v2.w,
    v1.x * v2.y + v1.y * v2.x + v1.z * v2.w - v1.w * v2.z,
    v1.x * v2.z + v1.z * v2.x + v1.w * v2.y - v1.y * v2.w,
    v1.x * v2.w + v1.w * v2.x + v1.y * v2.z - v1.z * v2.y
]
let quat_conj = (q) => [q[0], -q[1], -q[2], -q[3]]

let iters = 10
let max_norm = 4

let compute_sdf = (za, c) => {
    let z = za
    let md2 = 1.0
    let mz2 = dot(z, z)
    let iter = 0

    while(iter < iters){
        md2 = md2 * max_norm * mz2
        z = quat_mul(z, z) + c
        mz2 = z.dot(z)
        if (mz2 > max_norm){
            break
        }
        iter = iter + 1
    }
    return 0.25 * ti.sqrt(mz2 / md2) * ti.log(mz2)
}

let compute_normal = (z, c) => {
    let J0 = [1.0, 0.0, 0.0, 0.0]
    let J1 = [0.0, 1.0, 0.0, 0.0]
    let J2 = [0.0, 0.0, 1.0, 0.0]

    let z_curr = z

    let iterations = 0
    while (z_curr.norm() < max_norm && iterations < iters) {
        let cz = quat_conj(z_curr)
        J0 = [
            dot(J0, cz),
            dot(J0.xy, z_curr.yx),
            dot(J0.xz, z_curr.zx),
            dot(J0.xw, z_curr.wx)
        ]
        J1 = [
            dot(J1, cz),
            dot(J1.xy, z_curr.yx),
            dot(J1.xz, z_curr.zx),
            dot(J1.xw, z_curr.wx)
        ]
        J2 = [
            dot(J2, cz),
            dot(J2.xy, z_curr.yx),
            dot(J2.xz, z_curr.zx),
            dot(J2.xw, z_curr.wx)
        ]

        z_curr = quat_mul(z_curr, z_curr) + c
        iterations = iterations + 1
    }

    return [dot(J0, z_curr), dot(J1, z_curr), dot(J2, z_curr)].normalized()
}

let image_res = [720,400]
let image = ti.Vector.field(4, ti.f32, image_res)

let shade = (pos, surface_color, normal, light_pos) => {
    let light_color = [1, 1, 1]
    let light_dir =  (light_pos - pos).normalized()
    return light_color * surface_color * max(0.0, dot(light_dir, normal))
}

ti.addToKernelScope({quat_mul,quat_conj,iters,max_norm,compute_sdf,compute_normal,image_res,image,shade}) 
       
let march = ti.kernel(
    (time_arg) => {
        let time = time_arg * 0.15
        let c = 0.45 * ti.cos([0.5, 3.9, 1.4, 1.1] + time * [1.2, 1.7, 1.3, 2.5]) - [0.3, 0.0, 0.0, 0.0]

        let r = 1.8
        let o3 = [
            r * ti.cos(0.3 + 0.37 * time), 
            0.3 + 0.8 * r * ti.cos(1.0 + 0.33 * time), 
            r * ti.cos(2.2 + 0.31 * time)
        ].normalized() * r
        let ta = [0.0, 0.0, 0.0]
        let cr = 0.1 * ti.cos(0.1 * time)

        for(let I of ndrange(image_res[0], image_res[1])){
            let x = I[0]
            let y = I[1]
            
            let p = (-[image_res[0], image_res[1]] + 2.0 * [x, y]) / (image_res[1] * 0.75)

            let cw = (ta - o3).normalized()
            let cp = [ti.sin(cr), ti.cos(cr), 0.0]
            let cu = cw.cross(cp).normalized()
            let cv = cu.cross(cw).normalized()

            let d3 = (p.x * cu + p.y * cv + 2.0 * cw).normalized()
            let o = [o3.x, o3.y, o3.z, 0.0]
            let d = [d3.x, d3.y, d3.z, 0.0]

            let max_t = 10
            let t = 0.0
            let step = 0
            while(step < 300){
                let h = compute_sdf(o + t * d, c)
                t = t + h
                if (h < 0.0001 || t >= max_t){
                    break
                }
                step = step + 1
            }
                 
            if (t < max_t){
                let normal = compute_normal(o + t * d, c)
                let color = abs((o + t * d).xyz) / 1.3
                let pos = (o + t * d).xyz
                image[x, y] = (shade(pos, color, normal, o3), 1)
            }
            else{
                image[x, y] = [0, 0, 0, 1]
            }
        }
    }
)

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = image_res[0]
htmlCanvas.height = image_res[1]
let canvas = new ti.Canvas(htmlCanvas)

let i = 0
async function frame() {
    march(i / 60)
    i = i + 1
    canvas.setImage(image)
    requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

`

let vortex_ring = 
`await ti.init() 

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

export {fractal, fractal3D, vortex_ring}