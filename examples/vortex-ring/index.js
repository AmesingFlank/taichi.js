import * as ti from '../../dist/taichi.js'

let main = async () => {
    await ti.init()

    let resolution = [720, 360]

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
        return ((vort[i] * uv) / (r2 * Math.PI)) * 0.5 * (1.0 - exp(-r2 / eps ** 2))
    }

    let compute_u_full = (p) => {
        let u = [0.0, 0.0]
        for (let i of range(n_vortex)) {
            u = u + compute_u_single(p, i)
        }
        return u
    }

    ti.addToKernelScope({
        resolution,
        eps,
        dt,
        n_vortex,
        n_tracer,
        image,
        pos,
        new_pos,
        vort,
        tracer,
        compute_u_single,
        compute_u_full,
    })

    let integrate_vortex = ti.kernel(() => {
        for (let i of range(n_vortex)) {
            let v = [0.0, 0.0]
            for (let j of range(n_vortex)) {
                if (i != j) {
                    v = v + compute_u_single(pos[i], j)
                }
            }
            new_pos[i] = pos[i] + dt * v
        }
        for (let i of range(n_vortex)) {
            pos[i] = new_pos[i]
        }
    })

    let advect = ti.kernel(() => {
        for (let i of range(n_tracer)) {
            let p = tracer[i]
            let v1 = compute_u_full(p)
            let v2 = compute_u_full(p + v1 * dt * 0.5)
            let v3 = compute_u_full(p + v2 * dt * 0.75)
            tracer[i] = p + ((2 / 9) * v1 + (1 / 3) * v2 + (4 / 9) * v3) * dt
        }
    })

    let init_tracers = ti.kernel(() => {
        pos[0] = [0.0, 1.0]
        pos[1] = [0.0, -1.0]
        pos[2] = [0.0, 0.3]
        pos[3] = [0.0, -0.3]
        vort[0] = 1.0
        vort[1] = -1.0
        vort[2] = 1.0
        vort[3] = -1.0
        for (let i of range(n_tracer)) {
            let numX = 258
            let numY = 3 * numX
            let x = i32(i % numX)
            let y = i32((i - x) / numX)
            tracer[i] = [x / numX - 0.5, (y / numY) * 3 - 1.5]
        }
    })

    let paint = ti.kernel(() => {
        for (let I of ndrange(resolution[0], resolution[1])) {
            let i = I[0]
            let j = I[1]
            image[[i, j]] = [1.0, 1.0, 1.0, 1.0]
        }
        for (let i of range(n_tracer)) {
            let p = tracer[i] * [0.05, 0.1] + [0.0, 0.5]
            p[0] = p[0] * resolution[0]
            p[1] = p[1] * resolution[1]
            let ipos = i32(p)
            image[ipos] = [0.0, 0.0, 0.0, 1.0]
        }
    })

    init_tracers()
    paint()

    let htmlCanvas = document.getElementById('result_canvas')
    htmlCanvas.width = resolution[0]
    htmlCanvas.height = resolution[1]
    let canvas = new ti.Canvas(htmlCanvas)

    let frame = async () => {
        if (window.shouldStop) {
            return
        }
        for (let i = 0; i < 4; ++i) {
            advect()
            integrate_vortex()
        }
        paint()
        canvas.setImage(image)
        requestAnimationFrame(frame)
    }
    await frame()
}

main()
