import * as ti from "../../dist/taichi.js"

let main = async () => {
    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;

    await ti.init();

    let steps = 25;
    let n_grid = 32;
    let dt = 1e-4;
    let n_particles = 9000;

    let dx = 1 / n_grid;
    let p_vol = (dx * 0.5) ** 2;
    let p_rho = 1;
    let p_mass = p_vol * p_rho;
    let E = 1000;
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

    let group_size = n_particles / 3;

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
        group_size,
        WATER,
        SNOW,
        JELLY,
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
                        let weight = w[[i, 0]] * w[[j, 1]] * w[(k, 2)];
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

    let reset_3_materials = ti.kernel(() => {
        for (let i of range(n_particles)) {
            let group_id = i32(ti.floor(i / group_size));
            x[i] = [
                ti.random() * 0.2 + 0.3 + 0.1 * group_id,
                ti.random() * 0.2 + 0.05 + 0.32 * group_id,
                ti.random() * 0.2 + 0.3 + 0.1 * group_id,
            ];
            material[i] = group_id;
            v[i] = [0, 0, 0];
            F[i] = [
                [1 + 1e-6, 0, 0],
                [0, 1 - 1e-6, 0],
                [0, 0, 1],
            ];
            Jp[i] = 1;
            C[i] = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
            ];
        }
    });

    let reset_water_only = ti.kernel(() => {
        for (let i of range(n_particles)) {
            x[i] = [
                ti.random() * 0.3 + 0.05,
                ti.random() * 0.3 + 0.05 + 0.32,
                ti.random() * 0.3 + 0.05,
            ];
            material[i] = WATER;
            v[i] = [0, 0, 0];
            F[i] = [
                [1 + 1e-6, 0, 0],
                [0, 1 - 1e-6, 0],
                [0, 0, 1],
            ];
            Jp[i] = 1;
            C[i] = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
            ];
        }
    });

    let vertex_type = ti.types.struct({
        particle_pos: ti.types.vector(ti.f32, 3),
        vertex_pos: ti.types.vector(ti.f32, 2),
        material: ti.i32,
    });

    let VBO = ti.field(vertex_type, n_particles * 4);
    let IBO = ti.field(ti.i32, n_particles * 6);

    ti.addToKernelScope({ VBO, IBO });

    let init_vbo_ibo = ti.kernel(() => {
        for (let i of range(n_particles)) {
            IBO[i * 6 + 0] = i * 4 + 0;
            IBO[i * 6 + 1] = i * 4 + 1;
            IBO[i * 6 + 2] = i * 4 + 2;
            IBO[i * 6 + 3] = i * 4 + 1;
            IBO[i * 6 + 4] = i * 4 + 3;
            IBO[i * 6 + 5] = i * 4 + 2;

            VBO[i * 4 + 0].vertex_pos = [-1, -1];
            VBO[i * 4 + 1].vertex_pos = [1, -1];
            VBO[i * 4 + 2].vertex_pos = [-1, 1];
            VBO[i * 4 + 3].vertex_pos = [1, 1];

            for (let v of range(4)) {
                VBO[i * 4 + v].material = material[i];
            }
        }
    });

    let renderTarget = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    ti.addToKernelScope({ renderTarget, depth, aspectRatio });

    let render = ti.kernel(() => {
        for (let i of range(n_particles)) {
            for (let v of range(4)) {
                VBO[i * 4 + v].particle_pos = x[i];
            }
        }
        let center = [0.5, 0.3, 0.5];
        let eye = [0.5, 1.0, 1.95];
        let fov = 45;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(fov, aspectRatio, 0.1, 100);
        let mvp = proj.matmul(view);

        let light_pos = [0.5, 1.5, 1.0];
        let particles_radius = 0.015;

        ti.clearColor(renderTarget, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depth);

        // vert shader for vertices
        for (let v of ti.input_vertices(VBO, IBO)) {
            let distance = (eye - v.particle_pos).norm();
            let tanHalfFov = ti.tan((fov * Math.PI) / (180 * 2));
            let screen_radius = particles_radius / (tanHalfFov * distance);
            let clip_pos = mvp.matmul((v.particle_pos, 1.0));
            clip_pos.y += screen_radius * v.vertex_pos.y * clip_pos.w;
            clip_pos.x += (screen_radius * v.vertex_pos.x * clip_pos.w) / aspectRatio;
            ti.outputPosition(clip_pos);
            ti.outputVertex({
                point_coord: v.vertex_pos,
                center_pos_camera_space: view.matmul((v.particle_pos, 1.0)).xyz,
                material: v.material,
            });
        }
        // frag shader for vertices
        for (let f of ti.input_fragments()) {
            if (f.point_coord.norm() > 1) {
                ti.discard();
            }

            let z_in_sphere = ti.sqrt(1 - f.point_coord.norm_sqr());
            let coord_in_sphere = f.point_coord.concat([z_in_sphere]);
            let frag_pos_camera_space =
                f.center_pos_camera_space + coord_in_sphere * particles_radius;

            let clip_pos = proj.matmul(frag_pos_camera_space.concat([1.0]));
            let z = clip_pos.z / clip_pos.w;
            ti.outputDepth(z);

            let normal_camera_space = coord_in_sphere;
            let light_pos_camera_space = view.matmul(light_pos.concat([1.0])).xyz;
            let light_dir = (
                light_pos_camera_space - frag_pos_camera_space
            ).normalized();
            let c = normal_camera_space.dot(light_dir);

            let mat_color = f32([0, 0, 0, 0]);
            if (f.material == WATER) {
                mat_color = [0.1, 0.6, 0.9, 1.0];
            } else if (f.material == JELLY) {
                mat_color = [0.93, 0.33, 0.23, 1.0];
            } else if (f.material == SNOW) {
                mat_color = [1, 1, 1, 1.0];
            }

            let color = (c * mat_color.rgb).concat([1.0]);
            ti.outputColor(renderTarget, color);
        }
    });

    reset_water_only();
    init_vbo_ibo();
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