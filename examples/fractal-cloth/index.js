import * as ti from '../../dist/taichi.dev.js';

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('fractalClothCanvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;

    let N = 128;
    let cell_size = 1.0 / N;
    let gravity = 0.5;
    let stiffness = 1600;
    let damping = 2;
    let dt = 5e-4;

    let ball_radius = 0.3;
    let ball_center = ti.Vector.field(3, ti.f32, [1]);

    let x = ti.Vector.field(3, ti.f32, [N, N]);
    let v = ti.Vector.field(3, ti.f32, [N, N]);

    let links = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ];

    ti.addToKernelScope({
        N,
        cell_size,
        gravity,
        stiffness,
        damping,
        dt,
        ball_radius,
        ball_center,
        x,
        v,
        links,
    });

    let init_scene = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0];
            let j = I[1];
            x[[i, j]] = [i * cell_size, (j * cell_size) / ti.sqrt(2), ((N - j) * cell_size) / ti.sqrt(2)];
        }
        ball_center[0] = [0.5, -0.5, -0.1];
    });

    let step = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            v[I].y = v[I].y - gravity * dt;
        }
        for (let i of ti.ndrange(N, N)) {
            let force = [0.0, 0.0, 0.0];
            for (let link_id of ti.static(ti.range(8))) {
                let d = links[link_id];
                let j = min(max(i + d, [0, 0]), [N - 1, N - 1]);
                let relative_pos = x[j] - x[i];
                let current_length = relative_pos.norm();
                let original_length = cell_size * ti.f32(i - j).norm();
                if (original_length !== 0) {
                    force +=
                        (stiffness * relative_pos.normalized() * (current_length - original_length)) / original_length;
                }
            }
            v[i] = v[i] + force * dt;
        }
        for (let i of ti.ndrange(N, N)) {
            v[i] = v[i] * ti.exp(-damping * dt);
            if ((x[i] - ball_center[0]).norm() <= ball_radius) {
                v[i] = [0.0, 0.0, 0.0];
            }
            x[i] += dt * v[i];
        }
    });

    let fractal_dim = 320;
    let fractal_tex = ti.texture(4, [fractal_dim, fractal_dim]);
    let complex_sqr = (z) => {
        return [z[0] ** 2 - z[1] ** 2, z[1] * z[0] * 2];
    };

    ti.addToKernelScope({ fractal_dim, fractal_tex, complex_sqr });

    let fractal_kernel = ti.kernel((t) => {
        for (let I of ndrange(fractal_dim, fractal_dim)) {
            let i = I[0];
            let j = I[1];
            let c = [-0.8, cos(t) * 0.2];
            let z = [(i * 2) / fractal_dim - 1, j / fractal_dim - 0.5] * 2;
            let iterations = 0;
            while (z.norm() < 20 && iterations < 50) {
                z = complex_sqr(z) + c;
                iterations = iterations + 1;
            }
            let brightness = 1 - iterations * 0.02;
            let color = [brightness, brightness, brightness, 1.0];
            ti.textureStore(fractal_tex, I, color);
        }
    });

    let num_triangles = (N - 1) * (N - 1) * 2;
    let indices = ti.field(ti.i32, num_triangles * 3);
    let vertexType = ti.types.struct({
        pos: ti.types.vector(ti.f32, 3),
        normal: ti.types.vector(ti.f32, 3),
        local_pos: ti.types.vector(ti.f32, 2),
    });
    let vertices = ti.field(vertexType, N * N);

    let ball_vertices = ti.Vector.field(2, ti.f32, [4]);
    let ball_indices = ti.field(ti.i32, [6]);

    await ball_vertices.fromArray([
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ]);
    await ball_indices.fromArray([0, 1, 2, 1, 3, 2]);

    let renderTarget = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    ti.addToKernelScope({
        num_triangles,
        vertices,
        indices,
        renderTarget,
        depth,
        aspectRatio,
        ball_vertices,
        ball_indices,
    });

    let set_indices = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0];
            let j = I[1];
            if (i < N - 1 && j < N - 1) {
                let square_id = i * (N - 1) + j;
                // 1st triangle of the square
                indices[square_id * 6 + 0] = i * N + j;
                indices[square_id * 6 + 1] = (i + 1) * N + j;
                indices[square_id * 6 + 2] = i * N + (j + 1);
                // 2nd triangle of the square
                indices[square_id * 6 + 3] = (i + 1) * N + j + 1;
                indices[square_id * 6 + 4] = i * N + (j + 1);
                indices[square_id * 6 + 5] = (i + 1) * N + j;
            }
        }
    });

    let compute_normal = (a, b, c) => {
        return (a - b).cross(a - c).normalized();
    };
    ti.addToKernelScope({ compute_normal });

    let render = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let i = I[0];
            let j = I[1];
            vertices[i * N + j].pos = x[I];
            let normal = [0.0, 0.0, 0.0];
            let normal_count = 0;
            // average the normal of all adjacent triangles
            if (i < N - 1 && j < N - 1) {
                normal += compute_normal(x[[i, j]], x[[i + 1, j]], x[[i, j + 1]]);
                normal_count += 1;
            }
            if (i > 0 && j < N - 1) {
                normal += compute_normal(x[[i, j]], x[[i, j + 1]], x[[i - 1, j]]);
                normal_count += 1;
            }
            if (i > 0 && j > 0) {
                normal += compute_normal(x[[i, j]], x[[i - 1, j]], x[[i, j - 1]]);
                normal_count += 1;
            }
            if (i < N - 1 && j > 0) {
                normal += compute_normal(x[[i, j]], x[[i, j - 1]], x[[i + 1, j]]);
                normal_count += 1;
            }
            normal = normal / normal_count;
            vertices[i * N + j].normal = normal;
            vertices[i * N + j].local_pos = [i / (N - 1), j / (N - 1)];
        }

        let center = [0.5, -0.5, 0];
        let eye = [0.5, -0.5, 2];
        let fov = 45;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(fov, aspectRatio, 0.1, 100);
        let mvp = proj.matmul(view);

        let light_pos = [0.5, 1, 2];

        ti.clearColor(renderTarget, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depth);

        // vertex shader for cloth
        for (let v of ti.inputVertices(vertices, indices)) {
            let pos = mvp.matmul(v.pos.concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        // fragment shader for cloth
        for (let f of ti.inputFragments()) {
            let normal = f.normal.normalized();
            let frag_to_light = (light_pos - f.pos).normalized();
            let c = abs(normal.dot(frag_to_light));
            let color = c * ti.textureSample(fractal_tex, f.local_pos);
            color.a = 1;
            ti.outputColor(renderTarget, color);
        }
        // vertex shader for ball
        for (let v of ti.inputVertices(ball_vertices, ball_indices)) {
            let distance = (eye - ball_center[0]).norm();
            let tanHalfFov = ti.tan((fov * Math.PI) / (180 * 2));
            let screen_radius = ball_radius / (tanHalfFov * distance);
            let clip_pos = mvp.matmul(ball_center[0].concat([1.0]));
            clip_pos.y += screen_radius * v.y * clip_pos.w;
            clip_pos.x += (screen_radius * v.x * clip_pos.w) / aspectRatio;
            ti.outputPosition(clip_pos);
            ti.outputVertex({
                point_coord: v,
                center_pos_camera_space: view.matmul(ball_center[0].concat([1.0])).xyz,
            });
        }
        // frag shader for ball
        for (let f of ti.inputFragments()) {
            if (f.point_coord.norm() > 1) {
                ti.discard();
            }

            let z_in_sphere = ti.sqrt(1 - f.point_coord.normSqr());
            let coord_in_sphere = f.point_coord.concat([z_in_sphere]);
            let frag_pos_camera_space = f.center_pos_camera_space + coord_in_sphere * ball_radius * 0.99;

            let clip_pos = proj.matmul(frag_pos_camera_space.concat([1.0]));
            let z = clip_pos.z / clip_pos.w;
            ti.outputDepth(z);

            let normal_camera_space = coord_in_sphere;
            let light_pos_camera_space = view.matmul(light_pos.concat([1.0])).xyz;
            let light_dir = (light_pos_camera_space - frag_pos_camera_space).normalized();
            let c = normal_camera_space.dot(light_dir);
            let color = [c, 0, 0, 1.0];
            ti.outputColor(renderTarget, color);
        }
    });

    init_scene();
    set_indices();

    let frame_id = 0;
    async function frame() {
        if (window.shouldStop) {
            return;
        }
        for (let i = 0; i < 30; ++i) {
            step();
        }
        fractal_kernel(frame_id * 0.03);
        render();
        frame_id += 1;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
};
main();
