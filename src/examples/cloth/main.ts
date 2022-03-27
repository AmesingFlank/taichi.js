//@ts-nocheck  

let clothExample = async (htmlCanvas: HTMLCanvasElement) => {
    await ti.init() 

    let N = 128
    let cell_size = 1.0 / N
    let gravity = 0.5
    let stiffness = 1600
    let damping = 2
    let dt = 5e-4

    let links = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]

    let ball_radius = 0.2
    let ball_center = ti.Vector.field(3, ti.f32, [1])

    let x = ti.Vector.field(3, ti.f32, [N, N])
    let v = ti.Vector.field(3, ti.f32, [N, N])

    ti.addToKernelScope({
        N, cell_size, gravity, stiffness, damping, dt, links, ball_radius, ball_center, x, v
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
                let c = normal.dot(frag_to_light)
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
}

export{clothExample}