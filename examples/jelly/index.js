import * as ti from "../../dist/taichi.js"
let main = async () => {
    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;

    await ti.init();

    let steps = 25;
    let n_grid = 32;
    let dt = 1e-4;

    let cube_dim = 0.2;
    let cube_dim_particles = 13;
    let cube_num_particles = cube_dim_particles ** 3;
    let num_cubes = 5;
    let n_particles = num_cubes * cube_num_particles;

    let dx = 1 / n_grid;
    let p_vol = (dx * 0.5) ** 2;
    let p_rho = 1;
    let p_mass = p_vol * p_rho;
    let E = 100;
    let nu = 0.2; // Poisson's ratio
    let mu_0 = E / (2 * (1 + nu));
    let lambda_0 = (E * nu) / ((1 + nu) * (1 - 2 * nu)); // Lame parameters
    let gravity = ti.Vector.field(3, ti.f32, [1]);

    let x = ti.Vector.field(3, ti.f32, [n_particles]); // position
    let v = ti.Vector.field(3, ti.f32, [n_particles]); // velocity
    let C = ti.Matrix.field(3, 3, ti.f32, [n_particles]); // affine vel field
    let F = ti.Matrix.field(3, 3, ti.f32, n_particles); // deformation gradient
    let Jp = ti.field(ti.f32, [n_particles]); // plastic deformation
    let grid_v = ti.Vector.field(3, ti.f32, [n_grid, n_grid, n_grid]);
    let grid_m = ti.field(ti.f32, [n_grid, n_grid, n_grid]);

    let WATER = 0;
    let JELLY = 1;
    let SNOW = 2;
    let material = ti.field(ti.i32, [n_particles]); // material id

    ti.addToKernelScope({
        n_particles,
        n_grid,
        dx,
        dt,
        p_vol,
        p_rho,
        p_mass,
        E,
        nu,
        mu_0,
        lambda_0,
        gravity,
        x,
        v,
        C,
        F,
        material,
        Jp,
        grid_v,
        grid_m,
        WATER,
        SNOW,
        JELLY,
        cube_dim,
        cube_dim_particles,
        cube_num_particles,
        num_cubes,
    });

    let substep = ti.kernel(() => {
        for (let I of ti.ndrange(n_grid, n_grid, n_grid)) {
            grid_v[I] = [0, 0, 0];
            grid_m[I] = 0;
        }
        for (let p of ti.range(n_particles)) {
            let Xp = x[p] / dx;
            let base = i32(Xp - 0.5);
            let fx = Xp - base;
            let w = [
                0.5 * (1.5 - fx) ** 2,
                0.75 - (fx - 1) ** 2,
                0.5 * (fx - 0.5) ** 2,
            ];
            F[p] = (
                [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ] +
                dt * C[p]
            ).matmul(F[p]);
            let h = f32(ti.exp(10 * (1.0 - Jp[p])));
            if (material[p] == JELLY) {
                h = 0.3;
            }
            let mu = mu_0 * h;
            let la = lambda_0 * h;
            if (material[p] == WATER) {
                mu = 0.0;
            }
            let U = [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ];
            let sig = [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ];
            let V = [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ];
            ti.svd3D(F[p], U, sig, V);
            let J = f32(1.0);
            for (let d of ti.static(ti.range(3))) {
                let new_sig = sig[[d, d]];
                if (material[p] == SNOW) {
                    // Plasticity
                    new_sig = min(max(sig[[d, d]], 1 - 2.5e-2), 1 + 4.5e-3);
                }
                Jp[p] = (Jp[p] * sig[[d, d]]) / new_sig;
                sig[[d, d]] = new_sig;
                J = J * new_sig;
            }
            if (material[p] == WATER) {
                F[p] = [
                    [J, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ];
            } else if (material[p] == 2) {
                F[p] = U.matmul(sig).matmul(V.transpose());
            }
            let stress =
                (2 * mu * (F[p] - U.matmul(V.transpose()))).matmul(F[p].transpose()) +
                [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ] *
                la *
                J *
                (J - 1);
            stress = (-dt * p_vol * 4 * stress) / dx ** 2;
            let affine = stress + p_mass * C[p];
            for (let i of ti.static(ti.range(3))) {
                for (let j of ti.static(ti.range(3))) {
                    for (let k of ti.static(ti.range(3))) {
                        let offset = [i, j, k];
                        let dpos = (f32(offset) - fx) * dx;
                        let weight = w[[i, 0]] * w[[j, 1]] * w[[k, 2]];
                        grid_v[base + offset] +=
                            weight * (p_mass * v[p] + affine.matmul(dpos));
                        grid_m[base + offset] += weight * p_mass;
                    }
                }
            }
        }
        for (let I of ndrange(n_grid, n_grid, n_grid)) {
            let bound = 2;
            let i = I[0];
            let j = I[1];
            let k = I[2];
            if (grid_m[I] > 0) {
                grid_v[I] = (1 / grid_m[I]) * grid_v[I];
            }
            grid_v[I] = grid_v[I] + dt * gravity[0];
            if (i < bound && grid_v[I][0] < 0) {
                grid_v[I][0] = 0;
            }
            if (i > n_grid - bound && grid_v[I][0] > 0) {
                grid_v[I][0] = 0;
            }
            if (j < bound && grid_v[I][1] < 0) {
                grid_v[I][1] = 0;
            }
            if (j > n_grid - bound && grid_v[I][1] > 0) {
                grid_v[I][1] = 0;
            }
            if (k < bound && grid_v[I][2] < 0) {
                grid_v[I][2] = 0;
            }
            if (k > n_grid - bound && grid_v[I][2] > 0) {
                grid_v[I][2] = 0;
            }
        }
        for (let p of range(n_particles)) {
            let Xp = x[p] / dx;
            let base = i32(Xp - 0.5);
            let fx = Xp - base;
            let w = [
                0.5 * (1.5 - fx) ** 2,
                0.75 - (fx - 1.0) ** 2,
                0.5 * (fx - 0.5) ** 2,
            ];
            let new_v = [0.0, 0.0, 0.0];
            let new_C = [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ];
            for (let i of ti.static(ti.range(3))) {
                for (let j of ti.static(ti.range(3))) {
                    for (let k of ti.static(ti.range(3))) {
                        let offset = [i, j, k];
                        let dpos = (f32(offset) - fx) * dx;
                        let g_v = grid_v[base + offset];
                        let weight = w[[i, 0]] * w[[j, 1]] * w[[k, 2]];
                        new_v = new_v + weight * g_v;
                        new_C = new_C + (4 * weight * g_v.outer_product(dpos)) / (dx * dx);
                    }
                }
            }
            v[p] = new_v;
            C[p] = new_C;
            x[p] = x[p] + dt * new_v;
        }
    });

    let reset = ti.kernel(() => {
        for (let p of range(n_particles)) {
            let cube_id = i32(ti.floor(p / cube_num_particles));
            let cube_min = [
                0.05 + 0.15 * cube_id,
                0.05 + 0.25 * (cube_id % 3),
                0.05 + 0.2 * (cube_id % 4),
            ];
            let cube_max = cube_min + cube_dim;

            let id_in_cube = p % cube_num_particles;

            let i = i32(id_in_cube % cube_dim_particles);
            let j = i32(id_in_cube / cube_dim_particles) % cube_dim_particles;
            let k = i32(id_in_cube / (cube_dim_particles * cube_dim_particles));

            let pos = cube_min + (cube_dim * [i, j, k]) / cube_dim_particles;
            let jitter =
                ([ti.random(), ti.random(), ti.random()] * 0.1 * cube_dim) /
                cube_dim_particles;
            pos = pos + jitter;
            x[p] = pos;

            material[p] = JELLY;
            v[p] = [0, 0, 0];
            F[p] = [
                [1 + 1e-6, 0, 0],
                [0, 1 - 1e-6, 0],
                [0, 0, 1],
            ];
            Jp[p] = 1;
            C[p] = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
            ];
        }
    });

    let num_faces = num_cubes * 6;
    let num_quads_per_face = (cube_dim_particles - 1) ** 2;
    let num_quads = num_faces * num_quads_per_face;
    let num_triangles = num_quads * 2;
    let num_indices = num_triangles * 3;

    let num_vertices_per_face = cube_dim_particles ** 2;
    let num_vertices = num_faces * num_vertices_per_face;

    let vertex_type = ti.types.struct({
        pos: ti.types.vector(ti.f32, 3),
        normal: ti.types.vector(ti.f32, 3),
    });

    let VBO = ti.field(vertex_type, num_vertices);
    let IBO = ti.field(ti.i32, num_indices);
    let vertex_to_particle = ti.field(ti.i32, num_vertices);

    ti.addToKernelScope({
        VBO,
        IBO,
        vertex_to_particle,
        num_triangles,
        num_indices,
        num_vertices,
        num_quads,
        num_vertices_per_face,
        num_quads_per_face,
    });

    // define the triangle mesh for the surfaces of the cubes
    let init_ibo_vbo = ti.kernel(() => {
        for (let quad_id of range(num_quads)) {
            let face_id = i32(quad_id / num_quads_per_face);
            let quad_in_face = quad_id % num_quads_per_face;

            let cube_id = i32(face_id / 6);
            let face_in_cube = face_id % 6;
            let quad_i = quad_in_face % (cube_dim_particles - 1);
            let quad_j = i32(quad_in_face / (cube_dim_particles - 1));
            let di = [0, 0, 0];
            let dj = [0, 0, 0];
            let k = [0, 0, 0];
            if (face_in_cube == 0 || face_in_cube == 1) {
                di = [1, 0, 0];
                dj = [0, 1, 0];
                if (face_in_cube % 2 == 1) {
                    k = [0, 0, cube_dim_particles - 1];
                }
            }
            if (face_in_cube == 2 || face_in_cube == 3) {
                di = [0, 1, 0];
                dj = [0, 0, 1];
                if (face_in_cube % 2 == 1) {
                    k = [cube_dim_particles - 1, 0, 0];
                }
            }
            if (face_in_cube == 4 || face_in_cube == 5) {
                di = [1, 0, 0];
                dj = [0, 0, 1];
                if (face_in_cube % 2 == 1) {
                    k = [0, cube_dim_particles - 1, 0];
                }
            }

            let a = quad_i * di + quad_j * dj + k;
            let b = (quad_i + 1) * di + quad_j * dj + k;
            let c = quad_i * di + (quad_j + 1) * dj + k;
            let d = (quad_i + 1) * di + (quad_j + 1) * dj + k;

            let particle_idx_3d_to_1d = (idx) => {
                return (
                    cube_id * cube_num_particles +
                    idx[0] * cube_dim_particles ** 2 +
                    idx[1] * cube_dim_particles +
                    idx[2]
                );
            };

            let a_idx = particle_idx_3d_to_1d(a);
            let b_idx = particle_idx_3d_to_1d(b);
            let c_idx = particle_idx_3d_to_1d(c);
            let d_idx = particle_idx_3d_to_1d(d);

            let v_a =
                face_id * num_vertices_per_face + quad_i * cube_dim_particles + quad_j;
            let v_b =
                face_id * num_vertices_per_face +
                (quad_i + 1) * cube_dim_particles +
                quad_j;
            let v_c =
                face_id * num_vertices_per_face +
                quad_i * cube_dim_particles +
                (quad_j + 1);
            let v_d =
                face_id * num_vertices_per_face +
                (quad_i + 1) * cube_dim_particles +
                (quad_j + 1);

            vertex_to_particle[v_a] = a_idx;
            vertex_to_particle[v_b] = b_idx;
            vertex_to_particle[v_c] = c_idx;
            vertex_to_particle[v_d] = d_idx;

            if (face_in_cube == 0 || face_in_cube == 2 || face_in_cube == 5) {
                IBO[quad_id * 6 + 0] = v_a;
                IBO[quad_id * 6 + 1] = v_b;
                IBO[quad_id * 6 + 2] = v_c;
                IBO[quad_id * 6 + 3] = v_b;
                IBO[quad_id * 6 + 4] = v_d;
                IBO[quad_id * 6 + 5] = v_c;
            } else {
                IBO[quad_id * 6 + 0] = v_a;
                IBO[quad_id * 6 + 1] = v_c;
                IBO[quad_id * 6 + 2] = v_b;
                IBO[quad_id * 6 + 3] = v_c;
                IBO[quad_id * 6 + 4] = v_d;
                IBO[quad_id * 6 + 5] = v_b;
            }
        }
    });

    // used for computing per-vertex normal
    let normal_accum_type = ti.types.struct({
        count: ti.i32,
        sum: ti.types.vector(ti.f32, 3),
    });
    let normal_accume_buffer = ti.field(normal_accum_type, num_vertices);
    ti.addToKernelScope({ normal_accume_buffer });

    let update_vbo = ti.kernel(() => {
        let compute_normal = (a, b, c) => {
            return (a - b).cross(a - c).normalized();
        };
        for (let v of range(num_vertices)) {
            let p = vertex_to_particle[v];
            VBO[v].pos = x[p];
            normal_accume_buffer[v].count = 0;
            normal_accume_buffer[v].sum = 0;
        }
        for (let tri of range(num_triangles)) {
            let a = IBO[tri * 3 + 0];
            let b = IBO[tri * 3 + 1];
            let c = IBO[tri * 3 + 2];
            let normal = compute_normal(VBO[a].pos, VBO[b].pos, VBO[c].pos);
            normal_accume_buffer[a].count += 1;
            normal_accume_buffer[a].sum += normal;
            normal_accume_buffer[b].count += 1;
            normal_accume_buffer[b].sum += normal;
            normal_accume_buffer[c].count += 1;
            normal_accume_buffer[c].sum += normal;
        }
        for (let v of range(num_vertices)) {
            let accum = normal_accume_buffer[v];
            VBO[v].normal = accum.sum / accum.count;
        }
    });

    let renderTarget = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    ti.addToKernelScope({ renderTarget, depth, aspectRatio });

    let render = ti.kernel(() => {
        let center = [0.5, 0.5, 0.5];
        let eye = [0.5, 0.5, 2.3];
        let fov = 45;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(fov, aspectRatio, 0.1, 100);
        let mvp = proj.matmul(view);

        let front_light_pos = [0.5, 1.0, 2.0];
        let front_light_color = [1.0, 1.0, 1.0];
        let back_light_pos = [0.5, 1.0, -2.0];
        let back_light_color = [0.75, 0.75, 0.9];
        let jelly_color = [0.9, 0.3, 0.2];

        ti.clearColor(renderTarget, [0.75, 0.75, 0.9, 1]);
        ti.useDepth(depth);

        let saturate = (x) => max(0.0, min(1.0, x));

        let schlick = (N, V, IOR) => {
            let F0 = ((IOR - 1) / (IOR + 1)) ** 2;
            let F = F0 + (1 - F0) * pow(1 - max(0.0, dot(N, V)), 1);
            return F;
        };

        let smoothstep = (edge0, edge1, x) => {
            let t = (x - edge0) / (edge1 - edge0);
            t = max(0.0, min(1.0, t));
            return t * t * (3.0 - 2.0 * t);
        };

        let reflect = (n, l) => {
            return 2 * n * n.dot(l) - l;
        };

        let refract = (N, V, IOR) => {
            let n = 1 / IOR;
            let w = n * dot(N, V);
            let k = sqrt(1 + (w - n) * (w + n));
            let t = (w - k) * N + n * -V;
            return t.normalized();
        };

        let mix = (x, y, a) => {
            return x * (1.0 - a) + y * a;
        };

        // vert shader for vertices
        for (let v of ti.input_vertices(VBO, IBO)) {
            let pos = mvp.matmul(v.pos.concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        // frag shader for vertices
        for (let f of ti.input_fragments()) {
            let N = f.normal.normalized();
            let V = (eye - f.pos).normalized();

            let L_front = (front_light_pos - f.pos).normalized();
            let L_back = (back_light_pos - f.pos).normalized();

            let IOR = 1.5; // gelatin

            let V_refl = reflect(N, V);
            let fr = schlick(N, V, IOR);

            let refl_front = front_light_color * V_refl.dot(L_front) * fr;
            let refl_back = back_light_color * V_refl.dot(L_back) * fr;

            let refr_front =
                front_light_color *
                max(0.0, refract(N, V, IOR).dot(L_front)) *
                (1 - fr) *
                jelly_color;
            let refr_back =
                back_light_color *
                max(0.0, refract(N, V, IOR).dot(L_back)) *
                (1 - fr) *
                jelly_color;

            let color = refl_front + refl_back + refr_back + refr_front;
            ti.outputColor(renderTarget, color.concat([1.0]));
        }
    });

    reset();
    init_ibo_vbo();
    gravity.set([0], [0, -9.8, 0]);
    console.log('Try pressing W/A/S/D!');
    document.addEventListener('keydown', function (event) {
        if (event.key.toUpperCase() === 'W') {
            gravity.set([0], [0, 9.8, 0]);
        }
        if (event.key.toUpperCase() === 'A') {
            gravity.set([0], [-9.8, 0, 0]);
        }
        if (event.key.toUpperCase() === 'S') {
            gravity.set([0], [0, -9.8, 0]);
        }
        if (event.key.toUpperCase() === 'D') {
            gravity.set([0], [9.8, 0, 0]);
        }
    });

    let i = 0;
    async function frame() {
        if (window.shouldStop) {
            return;
        }
        for (let i = 0; i < Math.floor(steps); ++i) {
            substep();
        }
        update_vbo();
        render();
        i = i + 1;
        requestAnimationFrame(frame);
    }
    await frame();
};

main().then(() => {
    var h1 = document.getElementById('hint');
    h1.innerHTML = 'Try pressing W/A/S/D!';
    h1.focus();
}) 