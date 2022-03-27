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
    if(window.shouldStop){
        return
    }
    kernel(i * 0.03)
    i = i + 1
    canvas.setImage(pixels)
    requestAnimationFrame(frame)
}
await frame()
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
    if(window.shouldStop){
        return
    }
    march(i / 60)
    i = i + 1
    canvas.setImage(image)
    requestAnimationFrame(frame)
}
await frame()

`

let vortexRing = 
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

let frame = async () => {
    if(window.shouldStop){
        return
    }
    for(let i = 0; i< 4; ++i){
        advect()
        integrate_vortex()
    }
    paint()
    canvas.setImage(image)
    requestAnimationFrame(frame)
}
await frame()
`

let rasterizer = 
`await ti.init() 

let tile_size = 8 
let width = 512
let height = 512
let num_triangles = 60   
let num_samples_per_pixel = 4  
let num_spp_sqrt = Math.floor(Math.sqrt(num_samples_per_pixel)) 

let samples = ti.Vector.field(3, ti.f32,
                              [width, height, num_spp_sqrt, num_spp_sqrt])
let pixels = ti.Vector.field(4,  ti.f32, [width, height])

let A = ti.Vector.field(2, ti.f32, [num_triangles])
let B = ti.Vector.field(2, ti.f32, [num_triangles])
let C = ti.Vector.field(2, ti.f32, [num_triangles])
let c0 = ti.Vector.field(3, ti.f32, [num_triangles])
let c1 = ti.Vector.field(3, ti.f32, [num_triangles])
let c2 = ti.Vector.field(3, ti.f32, [num_triangles])
  
let block_num_triangles = ti.field(ti.i32, [width/tile_size, height/tile_size])
let block_indicies = ti.field(ti.i32, [width/tile_size, height/tile_size, num_triangles])

let point_in_triangle = (P, A, B, C) => {
    let alpha = -(P.x - B.x) * (C.y - B.y) + (P.y - B.y) * (C.x - B.x)
    alpha = alpha / (-(A.x - B.x) * (C.y - B.y) + (A.y - B.y) * (C.x - B.x))
    let beta = -(P.x - C.x) * (A.y - C.y) + (P.y - C.y) * (A.x - C.x)
    beta = beta / ( -(B.x - C.x) * (A.y - C.y) + (B.y - C.y) * (A.x - C.x))
    let gamma = 1.0 - alpha - beta
    let result = alpha >= 0.0 && alpha <= 1.0 && beta >= 0.0 && beta <= 1.0 && gamma >= 0.0
    return [result, alpha, beta, gamma]
}
    
let bbox_intersect = (A0, A1, B0, B1) => (B0.x < A1.x && B0.y < A1.y && B1.x > A0.x && B1.y > A0.y)

let num_blocks_x = width/tile_size
let num_blocks_y = height/tile_size

ti.addToKernelScope({tile_size,width,height,num_triangles,num_samples_per_pixel,num_spp_sqrt,
                    samples,pixels,A,B,C,c0,c1,c2,block_num_triangles,block_indicies,
                    point_in_triangle,bbox_intersect,num_blocks_x,num_blocks_y})

let set_triangle = ti.kernel (
    // ok this is bad...
    // TODO: support of non-scalar args
    (ii,v00,v01, v10,v11,v20,v21,c00,c01,c02,c10,c11,c12,c20,c21,c22) => { 
        let i = i32(ii)
        A[i] = [v00,v01] * [width,height]
        B[i] = [v10,v11] * [width,height]
        C[i] = [v20,v21] * [width,height]
        c0[i] = [c00,c01,c02]
        c1[i] = [c10,c11,c12]
        c2[i] = [c20,c21,c22]
    }
)

let tile_culling = ti.kernel(
    ()=>{
        for(let I of ndrange(num_blocks_x,num_blocks_y)){
            let i = I[0]
            let j = I[1]
            let idx = 0
            let tile_min = [i * tile_size, j * tile_size]
            let tile_max = [(i + 1) * tile_size, (j + 1) * tile_size]
            for(let t of range(num_triangles)){
                let tri_min = ti.min(A[t], ti.min(B[t], C[t]))
                let tri_max = ti.max(A[t], ti.max(B[t], C[t]))
                if (bbox_intersect(tile_min, tile_max, tri_min, tri_max)){
                    block_indicies[i, j, idx] = t
                    idx = idx + 1
                } 
            }
            block_num_triangles[i, j] = idx
        } 
    }
)
        
let rasterize = ti.kernel(
    ()=>{
        for(let I of ndrange(width,height)){
            let i = I[0]
            let j = I[1]
            let block_i = i32(i/tile_size)
            let block_j = i32(j/tile_size)
            let this_block_num = block_num_triangles[block_i,block_j]
            for(let k of range(this_block_num)){
                let idx = block_indicies[block_i, block_j, k]
                for(let sub of ndrange(num_spp_sqrt,num_spp_sqrt)){
                    let subi = sub[0]
                    let subj = sub[1]
                    let P = [
                        i + (subi + 0.5) / num_spp_sqrt,
                        j + (subj + 0.5) / num_spp_sqrt
                    ]
                    let point_info = point_in_triangle(P,A[idx],B[idx],C[idx])
                    if(point_info[0]){
                        samples[i, j, subi, subj] = 
                                c0[idx]*point_info[1] + 
                                c1[idx]*point_info[2] + 
                                c2[idx]*point_info[3]
                    }
                } 
            }
            let samples_sum = [0.0, 0.0, 0.0]
            for(let sub of ndrange(num_spp_sqrt,num_spp_sqrt)){
                let subi = sub[0]
                let subj = sub[1]
                samples_sum = samples_sum + samples[i, j, subi, subj]
            } 
            pixels[i, j] = ((samples_sum / num_samples_per_pixel), 1)
        }
    }
)
let fill_all = ti.kernel(
    ()=>{
        for(let I of ndrange(width,height)){
            let i = I[0]
            let j = I[1]
            for(let sub of ndrange(num_spp_sqrt,num_spp_sqrt)){
                let subi = sub[0]
                let subj = sub[1]
                samples[i, j, subi, subj] = [1,1,1]
            } 
        }
    }
)

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = width
htmlCanvas.height = height
let canvas = new ti.Canvas(htmlCanvas)

let i = 0
async function frame() {
    if(window.shouldStop){
        return
    }
    let args = [i % num_triangles]
    for(let i = 0; i<15;++i){
        args.push(Math.random())
    }
    set_triangle(...args)
    fill_all()
    tile_culling()
    rasterize()
    i = i + 1
    canvas.setImage(pixels)
    requestAnimationFrame(frame)
}
await frame()
  
`

let mpm99 = 
`
await ti.init() 

let quality = 1 
let n_particles = 9000 * quality**2
let n_grid = 128 * quality
let dx = 1 / n_grid
let inv_dx = n_grid
let dt = 1e-4 / quality
let p_vol = (dx * 0.5)**2
let p_rho =  1
let p_mass = p_vol * p_rho
let E = 5e3  // Young's modulus a
let nu =  0.2  // Poisson's ratio
let mu_0 = E / (2 * (1 + nu))
let lambda_0 =  E * nu / ((1 + nu) * (1 - 2 * nu))  // Lame parameters
let x = ti.Vector.field(2, ti.f32, [n_particles])  // position
let v = ti.Vector.field(2, ti.f32, [n_particles])  // velocity
let C = ti.Matrix.field(2, 2, ti.f32,  [n_particles])  // affine vel field
let F = ti.Matrix.field(2, 2, ti.f32, n_particles)  // deformation gradient
let material = ti.field(ti.i32, [n_particles])  // material id
let Jp = ti.field(ti.f32, [n_particles])  // plastic deformation
let grid_v = ti.Vector.field(2, ti.f32, [n_grid, n_grid])  
let grid_m = ti.field(ti.f32, [n_grid, n_grid])  

let img_size = 512
let image = ti.Vector.field(4, ti.f32, [img_size ,img_size])
let group_size = n_particles / 3

ti.addToKernelScope({ 
    n_particles,n_grid,dx,inv_dx,dt,p_vol,p_rho,p_mass,E,nu,mu_0,lambda_0,
    x,v,C,F,material,Jp,grid_v,grid_m,image,img_size,group_size 
}) 


let substep = ti.kernel(
    () =>{
        for(let I of ti.ndrange(n_grid,n_grid)){
            grid_v[I] = [0, 0]
            grid_m[I] = 0
        }
        for(let p of ti.range(n_particles)){
            let base = i32(x[p] * inv_dx - 0.5)
            let fx = x[p] * inv_dx - f32(base)
            let w = [0.5 * (1.5 - fx)**2, 0.75 - (fx - 1)**2, 0.5 * (fx - 0.5)**2]
            F[p] = ([[1.0,0.0],[0.0,1.0]] + dt * C[p]).matmul(F[p])
            let h = f32(max(0.1, min(5, ti.exp(10 * (1.0 - Jp[p])))))
            if(material[p]==1){
                h = 0.3
            }
            let mu = mu_0*h
            let la = lambda_0 * h
            if(material[p]==0){
                mu = 0.0
            }
            let U = [[0.0,0.0],[0.0,0.0]]
            let sig = [[0.0,0.0],[0.0,0.0]]
            let V = [[0.0,0.0],[0.0,0.0]]
            ti.svd2D(F[p], U, sig, V)
            let J = 1.0
            for(let d of ti.static(ti.range(2))){
                let new_sig = sig[d,d]
                if(material[p]==2){
                    // Plasticity
                    new_sig = min(max(sig[d, d], 1 - 2.5e-2), 1 + 4.5e-3)  
                }
                Jp[p] = Jp[p] * sig[d, d] / new_sig
                sig[d, d] = new_sig
                J = J * new_sig
            }
            if(material[p]==0){
                F[p] = [[1.0,0.0],[0.0,1.0]] * sqrt(J)
            }
            else if(material[p]==2){
                F[p] = U.matmul(sig).matmul(V.transpose())
            }
            let stress = 
                (2*mu* (F[p] - U.matmul(V.transpose()))).matmul(F[p].transpose())
                + [[1.0,0.0],[0.0,1.0]] * la * J * (J-1)
            stress = (-dt * p_vol * 4 * inv_dx * inv_dx) * stress
            let affine = stress + p_mass * C[p]
            for(let i of ti.static(ti.range(3))){
                for(let j of ti.static(ti.range(3))){
                    let offset = [i,j]
                    let dpos = (f32(offset) - fx) * dx
                    let weight = w[i,0] * w[j,1]
                    grid_v[base + offset] += weight * (p_mass * v[p] + affine.matmul(dpos))
                    grid_m[base + offset] += weight * p_mass
                }
            }

        }
        for(let I of ndrange(n_grid,n_grid)){
            let i = I[0]
            let j = I[1]
            if(grid_m[I] > 0){
                grid_v[I] = (1 / grid_m[I]) * grid_v[I]
                grid_v[I][1] -= dt * 50
                if(i < 3 && grid_v[I][0] < 0){
                    grid_v[I][0] = 0
                }
                if(i > n_grid - 3 && grid_v[I][0] > 0){
                    grid_v[I][0] = 0
                }
                if(j < 3 && grid_v[I][1] < 0){
                    grid_v[I][1] = 0
                }
                if(j > n_grid - 3 && grid_v[I][1] > 0){
                    grid_v[I][1] = 0
                }
            }
        }
        for(let p of range(n_particles)){
            let base = i32(x[p] * inv_dx - 0.5)
            let fx = x[p] * inv_dx - f32(base)
            let w = [0.5 * (1.5 - fx)**2, 0.75 - (fx - 1.0)**2, 0.5 * (fx - 0.5)**2]
            let new_v = [0.0,0.0]
            let new_C = [[0.0,0.0], [0.0,0.0]]
            for(let i of ti.static(ti.range(3))){
                for(let j of ti.static(ti.range(3))){
                    let dpos = f32([i,j]) - fx
                    let g_v = grid_v[base + [i,j]]
                    let weight = w[i,0] * w[j,1]
                    new_v = new_v + weight * g_v
                    new_C = new_C +  4 * inv_dx * weight * g_v.outer_product(dpos)
                }
            }
            v[p] = new_v
            C[p] = new_C
            x[p] = x[p] + dt * new_v
        }
    }
)

let reset = ti.kernel(
    () => {
        for(let i of range(n_particles)){
            let group_id = i32(ti.floor(i / group_size))
            x[i] = [
                ti.random() * 0.2 + 0.3 + 0.10 * group_id,
                ti.random() * 0.2 + 0.05 + 0.32 * group_id
            ]
            material[i] = group_id
            v[i] = [0, 0]
            F[i] = [[1, 0], [0, 1]]
            Jp[i] = 1
            C[i] = [[0, 0], [0, 0]]
        }
    }
)


let render = ti.kernel(
    () => {
        for(let I of ndrange(img_size,img_size)){
            image[I] = [0.067, 0.184, 0.255,1.0]
        }
        for(let i of range(n_particles)){
            let pos = x[i]
            let ipos = i32(pos * img_size)
            let this_color = f32([0,0,0,0])
            if(material[i] == 0){
                this_color = [0, 0.5, 0.5,1.0]
            }
            else if(material[i] == 1){
                this_color = [0.93, 0.33, 0.23,1.0]
            }
            else if(material[i] == 2){
                this_color = [1,1,1,1.0]
            }
            image[ipos] = this_color
        }
    }
)

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = img_size
htmlCanvas.height = img_size
let canvas = new ti.Canvas(htmlCanvas)

reset()

let i = 0
async function frame() {
    if(window.shouldStop){
        return
    }
    for(let i = 0;i< Math.floor(2e-3/dt);++i){
        substep()
    }
    render()
    i = i + 1
    canvas.setImage(image)
    requestAnimationFrame(frame)
}
await frame()
`

let cornellBox = 
`
await ti.init() 

let res = [800, 800]
let color_buffer = ti.Vector.field(3, ti.f32, res)
let count_var = ti.field(ti.i32, [1])
let tonemapped_buffer = ti.Vector.field(4, ti.f32, res)
let max_ray_depth = 10
let eps = 1e-4
let inf = 1e9
let fov = 0.8
let camera_pos = [0.0, 0.6, 3.0]

let mat_none = 0
let mat_lambertian = 1
let mat_specular = 2
let mat_glass = 3
let mat_light = 4

let light_y_pos = 2.0 - eps
let light_x_min_pos = -0.25
let light_x_range = 0.5
let light_z_min_pos = 1.0
let light_z_range = 0.12
let light_area = light_x_range * light_z_range
let light_min_pos = [light_x_min_pos, light_y_pos, light_z_min_pos]
let light_max_pos = [
    light_x_min_pos + light_x_range, light_y_pos,
    light_z_min_pos + light_z_range
]
let light_color = [0.9, 0.85, 0.7]
let light_normal = [0.0, -1.0, 0.0]

// No absorbtion, integrates over a unit hemisphere
let lambertian_brdf = 1.0 / Math.PI
// diamond!
let refr_idx = 2.4

// right sphere
let sp1_center = [0.4, 0.225, 1.75]
let sp1_radius = 0.22

let box_min = [0.0, 0.0, 0.0]
let box_max = [0.55, 1.1, 0.55]
let box_m_inv = [
    [ 0.92387953,  0.,          -0.38268343,    0.91459408],
    [ 0.,          1.,          0.,             0.,        ],
    [ 0.38268343,  0.,          0.92387953,     -0.37883727],
    [ 0.,          0.,          0.,             1.        ]]
let  box_m_inv_t =[
    [ 0.92387953,  0.,          0.38268343,  0.,        ],
    [ 0.,          1.,          0.,          0.,        ],
    [-0.38268343,  0.,          0.92387953,  0.,        ],
    [ 0.91459408,  0.,         -0.37883727,  1.,        ]]

let stratify_res = 5
let inv_stratify = 1.0 / 5.0

ti.addToKernelScope({
    res, color_buffer, count_var, tonemapped_buffer, 
    max_ray_depth, eps, inf,fov, camera_pos,
    mat_none, mat_glass,mat_lambertian,mat_light,mat_specular,
    light_y_pos, light_x_min_pos,light_x_range,
    light_z_min_pos,light_z_range, light_area,
    light_min_pos,light_max_pos,light_color,light_normal,
    lambertian_brdf,refr_idx,sp1_center,sp1_radius,
    box_min,box_max,box_m_inv,box_m_inv_t,
    stratify_res,inv_stratify
})

let reflect = (d, n) => {
    // Assuming |d| and |n| are normalized
    return d - 2.0 * d.dot(n) * n
}

let refract = (d, n, ni_over_nt) => {
    // Assuming |d| and |n| are normalized
    let has_r = 0
    let rd = d 
    let dt = d.dot(n)
    let  discr = 1.0 - ni_over_nt * ni_over_nt * (1.0 - dt * dt)
    if (discr > 0.0) {
        has_r = 1
        rd = (ni_over_nt * (d - n * dt) - n * ti.sqrt(discr)).normalized()
    }
    else{
        rd = 0.0
    } 
    return rd
}

let mat_mul_point = (m, p) =>  {
    let hp = [p[0], p[1], p[2], 1.0]
    hp = m.matmul(hp)
    return hp.xyz / hp.w
}

let mat_mul_vec = (m, v) => {
    let hv = [v[0], v[1], v[2], 0.0]
    hv = m.matmul(hv)
    return hv.xyz
}

let intersect_sphere = (pos, d, center, radius, hit_pos) => {
    let T = pos - center
    let A = 1.0
    let B = 2.0 * T.dot(d)
    let C = T.dot(T) - radius * radius
    let delta = B * B - 4.0 * A * C
    let dist = f32(inf)
    hit_pos = [0.0, 0.0, 0.0]

    if (delta > -1e-4){
        delta = ti.max(delta, 0)
        let sdelta = ti.sqrt(delta)
        let ratio = 0.5 / A
        let ret1 = ratio * (-B - sdelta)
        dist = ret1
        if (dist < inf) {
            // refinement
            let old_dist = dist
            let new_pos = pos + d * dist
            T = new_pos - center
            A = 1.0
            B = 2.0 * T.dot(d)
            C = T.dot(T) - radius * radius
            delta = B * B - 4 * A * C
            if (delta > 0) {
                sdelta = ti.sqrt(delta)
                ratio = 0.5 / A
                ret1 = ratio * (-B - sdelta) + old_dist
                if (ret1 > 0) {
                    dist = ret1
                    hit_pos = new_pos + ratio * (-B - sdelta) * d
                }
            }
            else{
                dist = inf
            }
        }
    }
    return dist
}

let intersect_plane = (pos, d, pt_on_plane, norm, dist, hit_pos) => {
    dist = inf
    hit_pos = [0.0, 0.0, 0.0]
    let denom = d.dot(norm)
    if (abs(denom) > eps){
        dist = norm.dot(pt_on_plane - pos) / denom
        hit_pos = pos + d * dist 
    }
}

let intersect_aabb = (box_min, box_max, o, d,near_t, far_t, near_norm) => {
    let intersect = 1

    near_t = -inf
    far_t = inf
    near_norm = [0.0, 0.0, 0.0]

    let near_face = 0
    let near_is_max = 0

    for (let i of ti.static(range(3))) {
        if (d[i] == 0) {
            if (o[i] < box_min[i] || o[i] > box_max[i]) {
                intersect = 0
            }
        }
        else {
            let i1 = (box_min[i] - o[i]) / d[i]
            let i2 = (box_max[i] - o[i]) / d[i]

            let new_far_t = max(i1, i2)
            let new_near_t = min(i1, i2)
            let new_near_is_max = i2 < i1

            far_t = min(new_far_t, far_t)
            if (new_near_t > near_t) {
                near_t = new_near_t
                near_face = i32(i)
                near_is_max = new_near_is_max
            }
        }
    }           
    if (near_t > far_t) {
        intersect = 0
    }
    if (intersect) {
        for (let i of ti.static(range(3))) {
            if (near_face == i) {
                near_norm[i] = -1 + near_is_max * 2
            }
        }
    }
    return intersect
}

let intersect_aabb_transformed = (box_min, box_max, o, d, near_t, near_norm) => {
    // Transform the ray to the box's local space
    let obj_o = mat_mul_point(box_m_inv, o)
    let obj_d = mat_mul_vec(box_m_inv, d)
    let far_t = f32(inf)
    let intersect = intersect_aabb(box_min, box_max, obj_o, obj_d, near_t, far_t, near_norm)
    if (intersect && 0 < near_t) {
        // Transform the normal in the box's local space to world space
        near_norm = mat_mul_vec(box_m_inv_t, near_norm)
    }
    else {
        intersect = 0
    }
    return intersect
}

let intersect_light = (pos, d, tmax, t) => {
    let far_t = f32(inf)
    let near_norm = f32([0,0,0])
    let hit = intersect_aabb(light_min_pos, light_max_pos, pos, d, t, far_t, near_norm)
    if (hit && 0 < t && t < tmax) {
        hit = 1
    }
    else {
        hit = 0
        t = inf
    }
    return hit 
}

let intersect_scene = (pos, ray_dir, normal, c, mat) => {
    let closest = f32(inf)

    let cur_dist = f32(inf)
    let hit_pos = [0.0,0.0,0.0]

    // right near sphere
    cur_dist = intersect_sphere(pos, ray_dir, sp1_center, sp1_radius, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = (hit_pos - sp1_center).normalized()
        c  = [1.0, 1.0, 1.0]
        mat =  mat_glass
    }
    // left box
    let pnorm = f32([0, 0, 0])
    let hit = intersect_aabb_transformed(box_min, box_max, pos,  ray_dir, cur_dist, pnorm)
    if (hit && 0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = [0.8, 0.5, 0.4]
        mat = mat_specular
    }
    // left
    pnorm = [1.0, 0.0, 0.0]
    
    intersect_plane(pos, ray_dir, [-1.1, 0.0, 0.0], pnorm, cur_dist, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = [0.65, 0.05, 0.05]
        mat = mat_lambertian
    }
    // right
    pnorm = [-1.0, 0.0, 0.0]
    intersect_plane(pos, ray_dir, [1.1, 0.0, 0.0], pnorm, cur_dist, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = [0.12, 0.45, 0.15]
        mat = mat_lambertian
    }
    // bottom
    let gray = [0.93, 0.93, 0.93]
    pnorm = [0.0, 1.0, 0.0]
    intersect_plane(pos, ray_dir, [0.0, 0.0, 0.0], pnorm, cur_dist, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = gray
        mat = mat_lambertian
    }
    // top
    pnorm = [0.0, -1.0, 0.001]
    intersect_plane(pos, ray_dir, [0.0, 2.0, 0.0], pnorm,cur_dist, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = gray
        mat = mat_lambertian
    }
    // far
    pnorm = [0.0, 0.0, 1.0]
    intersect_plane(pos, ray_dir, [0.0, 0.0, 0.0],pnorm, cur_dist, hit_pos)
    if (0 < cur_dist && cur_dist < closest) {
        closest = cur_dist
        normal = pnorm
        c = gray
        mat = mat_lambertian
    }
    let hit_l = intersect_light(pos, ray_dir, closest, cur_dist)
    if (hit_l && 0 < cur_dist && cur_dist < closest) {
        // technically speaking, no need to check the second term
        closest = cur_dist
        normal = light_normal
        c = gray
        mat = mat_light
    }
    return closest
}


let visible_to_light = (pos, ray_dir) => {
    // eps*ray_dir is easy way to prevent rounding error
    // here is best way to check the float precision) {
    // http://www.pbr-book.org/3ed-2018/Shapes/Managing_Rounding_Error.html
    
    let normal = f32([0,0,0])
    let c = f32([0,0,0])
    let mat = mat_none 
    intersect_scene(pos + eps * ray_dir, ray_dir, normal,c,mat)
    return (mat == mat_light)
}

let dot_or_zero = (n, l) => {
    return max(0.0, n.dot(l))
}

let mis_power_heuristic = (pf, pg) => {
    // Assume 1 sample for each distribution
    let f = pf**2
    let g = pg**2
    return f / (f + g)
}

let compute_area_light_pdf = (pos, ray_dir) => {
    let t = 0.0
    let hit_l = intersect_light(pos, ray_dir, inf, t)
    let pdf = 0.0
    if (hit_l) {
        let l_cos = light_normal.dot(-ray_dir)
        if (l_cos > eps) {
            let tmp = ray_dir * t
            let dist_sqr = tmp.dot(tmp)
            pdf = dist_sqr / (light_area * l_cos)
        }
    }
    return pdf
}

let compute_brdf_pdf = (normal, sample_dir) => {
    return dot_or_zero(normal, sample_dir) / Math.PI
}

let sample_area_light = (hit_pos, pos_normal) => {
    // sampling inside the light area
    let x = ti.random() * light_x_range + light_x_min_pos
    let z = ti.random() * light_z_range + light_z_min_pos
    let on_light_pos = [x, light_y_pos, z]
    return (on_light_pos - hit_pos).normalized()
}

let sample_brdf = (normal) => {
    // cosine hemisphere sampling
    // Uniformly sample on a disk using concentric sampling(r, theta)
    let r = 0.0
    let theta = 0.0
    let sx = ti.random() * 2.0 - 1.0
    let sy = ti.random() * 2.0 - 1.0
    if (sx != 0 || sy != 0) {
        if (abs(sx) > abs(sy)) {
            r = sx
            theta = Math.PI / 4 * (sy / sx)
        }
        else {
            r = sy
            theta = Math.PI / 4 * (2 - sx / sy)
        }
    }
    // Apply Malley's method to project disk to hemisphere
    let u = [1.0, 0.0, 0.0]
    if (abs(normal[1]) < 1 - eps) {
        u = normal.cross([0.0, 1.0, 0.0])
    }
    let v = normal.cross(u)
    let costt = ti.cos(theta)
    let sintt = ti.sin(theta)
    let xy = (u * costt + v * sintt) * r
    let zlen = ti.sqrt(max(0.0, 1.0 - xy.dot(xy)))
    return xy + zlen * normal
}

let sample_direct_light =(hit_pos, hit_normal, hit_color) => {
    let direct_li = [0.0, 0.0, 0.0]
    let fl = lambertian_brdf * hit_color * light_color
    let light_pdf = 0.0
    let brdf_pdf = 0.0 

    // sample area light
    let to_light_dir = sample_area_light(hit_pos, hit_normal)
    if (to_light_dir.dot(hit_normal) > 0) {
        light_pdf = compute_area_light_pdf(hit_pos, to_light_dir)
        brdf_pdf = compute_brdf_pdf(hit_normal, to_light_dir)
        if (light_pdf > 0 && brdf_pdf > 0) {
            let l_visible = visible_to_light(hit_pos, to_light_dir)
            if (l_visible) {
                let w = mis_power_heuristic(light_pdf, brdf_pdf)
                let nl = dot_or_zero(to_light_dir, hit_normal)
                direct_li += fl * w * nl / light_pdf
            }
        }
    }

    // sample brdf
    let brdf_dir = sample_brdf(hit_normal)
    brdf_pdf = compute_brdf_pdf(hit_normal, brdf_dir)
    if (brdf_pdf > 0) {
        light_pdf = compute_area_light_pdf(hit_pos, brdf_dir)
        if (light_pdf > 0) {
            let l_visible = visible_to_light(hit_pos, brdf_dir)
            if (l_visible) {
                let w = mis_power_heuristic(brdf_pdf, light_pdf)
                let nl = dot_or_zero(brdf_dir, hit_normal)
                direct_li += fl * w * nl / brdf_pdf
            }
        }
    }
    return direct_li
}

let schlick = (cos, eta) => {
    let r0 = (1.0 - eta) / (1.0 + eta)
    r0 = r0 * r0
    return r0 + (1 - r0) * ((1.0 - cos)**5)
}

let sample_ray_dir = (indir, normal, hit_pos, mat, pdf) => {
    let u = [0.0, 0.0, 0.0]
    pdf = 1.0
    if (mat == mat_lambertian){
        u = sample_brdf(normal)
        pdf = max(eps, compute_brdf_pdf(normal, u))
    }
    else if(mat == mat_specular){
        u = reflect(indir, normal)
    }
    else if(mat == mat_glass){
        let cos = indir.dot(normal)
        let ni_over_nt = refr_idx
        let outn = normal
        if (cos > 0.0){
            outn = -normal
            cos = refr_idx * cos
        }
        else{
            ni_over_nt = 1.0 / refr_idx
            cos = -cos
        } 
            
        let refr_dir = refract(indir, outn, ni_over_nt)
        let has_refr = 1
        if (refr_dir.norm_sqr() == 0.0){
            has_refr = 0
        }
        let refl_prob = 1.0
        if (has_refr) {
            refl_prob = schlick(cos, refr_idx)
        }
            
        if (ti.random() < refl_prob){
            u = reflect(indir, normal)
        }
        else{
            u = refr_dir
        }
    } 
    return u.normalized() 
}

ti.addToKernelScope({
    reflect,refract,mat_mul_point,mat_mul_vec,
    intersect_aabb,intersect_aabb_transformed,
    intersect_light,intersect_plane,intersect_sphere,
    intersect_scene,
    visible_to_light,dot_or_zero,mis_power_heuristic,
    compute_area_light_pdf,compute_brdf_pdf,
    sample_area_light,sample_brdf,sample_direct_light,
    schlick,sample_ray_dir
})

let render = ti.kernel (() => {
    for (let UV of ndrange(res[0], res[1])) {
        let u = UV[0]
        let v = UV[1]
        let aspect_ratio = res[0] / res[1]
        let pos = camera_pos
        let cur_iter = count_var[0]
        let str_x  = i32(cur_iter / stratify_res)
        let str_y =  (cur_iter % stratify_res)
        let ray_dir = [
            (2 * fov * (u + (str_x + ti.random()) * inv_stratify) / res[1] -
             fov * aspect_ratio - 1e-5),
            (2 * fov * (v + (str_y + ti.random()) * inv_stratify) / res[1] -
             fov - 1e-5),
            -1.0,
        ]
        ray_dir = ray_dir.normalized()

        let acc_color = [0.0, 0.0, 0.0]
        let throughput = [1.0, 1.0, 1.0]

        let depth = 0
        while (depth < max_ray_depth) {
            
            let hit_normal = f32([0,0,0])
            let hit_color = f32([0,0,0])
            let mat = mat_none 
            let closest = intersect_scene(pos, ray_dir, hit_normal, hit_color, mat)
            if (mat == mat_none) {
                break
            }
            let hit_pos = pos + closest * ray_dir
            let hit_light = (mat == mat_light)
            if (hit_light) {
                acc_color = acc_color + throughput * light_color
                break
            }
            else if (mat == mat_lambertian) {
                acc_color = acc_color + throughput * sample_direct_light(
                    hit_pos, hit_normal, hit_color)
            }
            depth += 1
            let pdf = 1.0
            ray_dir = sample_ray_dir(ray_dir, hit_normal, hit_pos, mat, pdf)
            pos = hit_pos + 1e-4 * ray_dir
            if (mat == mat_lambertian) {
                throughput = 
                    throughput * 
                    lambertian_brdf * hit_color * dot_or_zero( hit_normal, ray_dir) 
                    / pdf
            }
            else {
                throughput = throughput * hit_color
            }
        }
        color_buffer[u, v] = color_buffer[u, v] + acc_color
    }
    count_var[0] = (count_var[0] + 1) % (stratify_res * stratify_res)
})

let tonemap = ti.kernel((accumulated) => {
    for(let I of ndrange(res[0], res[1])) {
        tonemapped_buffer[I] = 
            (ti.sqrt(color_buffer[I] / accumulated * 100.0), 1.0)
    }
})           

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = 500
htmlCanvas.height = 500
let canvas = new ti.Canvas(htmlCanvas)
 
 
let interval = 10
let last_t = new Date().getTime()
let total_samples = 0
async function frame() {
    if(window.shouldStop){
        return
    }
    for(let i = 0; i < interval; ++i){
        render()
        total_samples += 1
    }
    tonemap(total_samples)
    await ti.sync() // otherwise the time measurement is weird
    let curr_t = new Date().getTime()
    let duration_seconds = (curr_t - last_t) / 1000.0
    let samplesPerSecond = interval / duration_seconds
    console.log(samplesPerSecond," samples/s")
    last_t = curr_t
    canvas.setImage(tonemapped_buffer)
    requestAnimationFrame(frame)
}
await frame()

`

let rotatingCube = `
await ti.init()

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = 720
htmlCanvas.height = 360

let VBO = ti.field(ti.types.vector(ti.f32, 3), 8)
let IBO = ti.field(ti.i32, 36)
let aspectRatio = htmlCanvas.width / htmlCanvas.height
let target = ti.canvasTexture(htmlCanvas)
let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height])

ti.addToKernelScope({ VBO, target, IBO, aspectRatio, depth })

await VBO.fromArray([[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [1, 1, 1]])
await IBO.fromArray([
  0, 1, 2,
  1, 3, 2,
  4, 5, 6,
  5, 7, 6,
  0, 2, 4,
  2, 6, 4,
  1, 3, 5,
  3, 7, 5,
  0, 1, 4,
  1, 5, 4,
  2, 3, 6,
  3, 7, 6
])

let render = ti.kernel(
  (t) => {
    let center = [0.5, 0.5, 0.5]
    let eye = center + [ti.sin(t),0.5,ti.cos(t)] * 2
    let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0])
    let proj = ti.perspective(45.0, aspectRatio, 0.1, 100)
    let mvp = proj.matmul(view)

    ti.clearColor(target, [0.1, 0.2, 0.3, 1])
    ti.useDepth(depth)

    for (let v of ti.input_vertices(VBO, IBO)) {
      let pos = mvp.matmul((v, 1.0))
      ti.outputPosition(pos)
      ti.outputVertex(v)
    }
    for (let f of ti.input_fragments()) {
      let color = (f, 1.0)
      ti.outputColor(target, color)
    }
  }
)

let i = 0
async function frame() {
  if(window.shouldStop){
    return
  }
  render(i * 0.03)
  i = i + 1
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

`

let cloth = `
await ti.init()

let htmlCanvas = document.getElementById("result_canvas")
htmlCanvas.width = 720
htmlCanvas.height = 360

let N = 128
let cell_size = 1.0 / N
let gravity = 0.5
let stiffness = 1600
let damping = 2
let dt = 5e-4

let ball_radius = 0.2
let ball_center = ti.Vector.field(3, ti.f32, [1])

let x = ti.Vector.field(3, ti.f32, [N, N])
let v = ti.Vector.field(3, ti.f32, [N, N])

let links = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]

ti.addToKernelScope({
    N, cell_size, gravity, stiffness, damping, dt, ball_radius, ball_center, x, v, links
})

let init_scene = ti.kernel(
    () => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0]
            let j = I[1]
            x[i, j] = [
                i * cell_size, j * cell_size / ti.sqrt(2),
                (N - j) * cell_size / ti.sqrt(2)
            ]
        }
        ball_center[0] = [0.5, -0.5, -0.0]
    }
)

let step = ti.kernel(
    () => {
        for (let I of ti.ndrange(N, N)) {
            v[I].y = v[I].y - gravity * dt
        }
        for (let i of ti.ndrange(N, N)) {
            let force = [0.0, 0.0, 0.0]
            for (let link_id of ti.static(ti.range(8))) {
                let d = links[link_id]
                let j = min(max(i + d, [0, 0]), [N - 1, N - 1])
                let relative_pos = x[j] - x[i]
                let current_length = relative_pos.norm()
                let original_length = cell_size * ti.f32(i - j).norm()
                if (original_length !== 0) {
                    force +=
                        stiffness * relative_pos.normalized() *
                        (current_length - original_length) / original_length
                }
            }
            v[i] = v[i] + force * dt
        }
        for (let i of ti.ndrange(N, N)) {
            v[i] = v[i] * ti.exp(-damping * dt)
            if ((x[i] - ball_center[0]).norm() <= ball_radius) {
                v[i] = [0.0, 0.0, 0.0]
            }
            x[i] += dt * v[i]
        }
    }
)

let num_triangles = (N - 1) * (N - 1) * 2
let indices = ti.field(ti.i32, num_triangles * 3)
let vertexType = ti.types.struct({
    "pos": ti.types.vector(ti.f32, 3),
    "normal": ti.types.vector(ti.f32, 3)
})
let vertices = ti.field(vertexType, N * N)

let renderTarget = ti.canvasTexture(htmlCanvas)
let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height])
let aspectRatio = htmlCanvas.width / htmlCanvas.height

ti.addToKernelScope({ num_triangles, vertices, indices, renderTarget, depth, aspectRatio })

let set_indices = ti.kernel(
    () => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0]
            let j = I[1]
            if (i < N - 1 && j < N - 1) {
                let square_id = (i * (N - 1)) + j
                // 1st triangle of the square
                indices[square_id * 6 + 0] = i * N + j
                indices[square_id * 6 + 1] = (i + 1) * N + j
                indices[square_id * 6 + 2] = i * N + (j + 1)
                // 2nd triangle of the square
                indices[square_id * 6 + 3] = (i + 1) * N + j + 1
                indices[square_id * 6 + 4] = i * N + (j + 1)
                indices[square_id * 6 + 5] = (i + 1) * N + j
            }
        }
    }
)
set_indices() // the IBO is fixed, only needs to be done once

let compute_normal = (a, b, c) => {
    return (a - b).cross(a - c).normalized()
}
ti.addToKernelScope({ compute_normal })

let render = ti.kernel(
    () => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0]
            let j = I[1]
            vertices[i * N + j].pos = x[I]
            let normal = [0.0, 0.0, 0.0]
            let normal_count = 0
            // average the normal of all adjacent triangles
            if (i < N - 1 && j < N - 1) {
                normal += compute_normal(x[i, j], x[i + 1, j], x[i, j + 1])
                normal_count += 1
            }
            if (i > 0 && j < N - 1) {
                normal += compute_normal(x[i, j], x[i, j + 1], x[i - 1, j])
                normal_count += 1
            }
            if (i > 0 && j > 0) {
                normal += compute_normal(x[i, j], x[i - 1, j], x[i, j - 1])
                normal_count += 1
            }
            if (i < N - 1 && j > 0) {
                normal += compute_normal(x[i, j], x[i, j - 1], x[i + 1, j])
                normal_count += 1
            }
            normal = normal / normal_count
            vertices[i * N + j].normal = normal
        }

        let center = [0.5, -0.5, 0]
        let eye = [0.5, -0.5, 2]
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0])
        let proj = ti.perspective(45.0, aspectRatio, 0.1, 100)
        let mvp = proj.matmul(view)

        let light_pos = [0.5, 1, 2]

        ti.clearColor(renderTarget, [0.1, 0.2, 0.3, 1])
        ti.useDepth(depth)

        for (let v of ti.input_vertices(vertices, indices)) {
            let pos = mvp.matmul((v.pos, 1.0))
            ti.outputPosition(pos)
            ti.outputVertex(v)
        }
        for (let f of ti.input_fragments()) {
            let normal = f.normal.normalized()
            let frag_to_light = (light_pos - f.pos).normalized()
            let c = normal.dot(frag_to_light) * 0.8
            let color = [c, c, c, 1.0]
            ti.outputColor(renderTarget, color)
        }
    }
)

init_scene()
set_indices()

async function frame() {
    if (window.shouldStop) {
        return
    }
    for (let i = 0; i < 30; ++i) {
        step()
    }
    render()
    requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
`
export {fractal, fractal3D, vortexRing, rasterizer, mpm99, cornellBox, rotatingCube, cloth}