import * as ti from "../../dist/taichi.dev.js"

let main = async () => {
    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;

    await ti.init();

    let steps = 25;
    let n_grid = 32;
    let dt = 1e-4;
    let numParticles = 9000;

    let dx = 1 / n_grid;
    let particleVol = (dx * 0.5) ** 2;
    let particleDensity = 1;
    let particleMass = particleVol * particleDensity;
    let E = 1000;
    let nu = 0.2; // Poisson's ratio
    let mu0 = E / (2 * (1 + nu));
    let lambda0 = (E * nu) / ((1 + nu) * (1 - 2 * nu)); // Lame parameters
    let gravity = ti.Vector.field(3, ti.f32, [1]);

    let cellInfo = ti.types.struct({
        v: ti.types.vector(ti.f32, 3),
        m: ti.f32,
        numParticles: ti.i32
    })

    let grid = ti.field(cellInfo, [n_grid, n_grid, n_grid])

    let maxParticlesPerCell = 1000
    let gridParticleIds = ti.field(ti.i32, [n_grid, n_grid, n_grid, maxParticlesPerCell])
    let gridParticleWeights = ti.field(ti.f32, [n_grid, n_grid, n_grid, maxParticlesPerCell])

    let particleInfo = ti.types.struct({
        x: ti.types.vector(ti.f32, 3),
        v: ti.types.vector(ti.f32, 3),
        C: ti.types.matrix(ti.f32, 3, 3),
        J: ti.f32
    })

    let particles = ti.field(particleInfo, [numParticles])

    ti.addToKernelScope({
        numParticles,
        n_grid,
        dx,
        dt,
        particleVol,
        particleDensity,
        particleMass,
        E,
        nu,
        mu0,
        lambda0,
        gravity,

        particles,
        grid,
        gridParticleIds,
        gridParticleWeights
    });

    let substep = ti.kernel(() => {
        for (let I of ti.ndrange(n_grid, n_grid, n_grid)) {
            grid[I].v = [0.0, 0.0, 0.0];
            grid[I].m = 0.0;
            grid[I].numParticles = 0
        }
        for (let p of ti.range(numParticles)) {
            let Xp = particles[p].x / dx;
            let base = i32(Xp - 0.5);
            let fx = Xp - base;
            let w = [
                0.5 * (1.5 - fx) ** 2,
                0.75 - (fx - 1) ** 2,
                0.5 * (fx - 0.5) ** 2,
            ];
            for (let i of ti.static(ti.range(3))) {
                for (let j of ti.static(ti.range(3))) {
                    for (let k of ti.static(ti.range(3))) {
                        let offset = [i, j, k];
                        let cell = base + offset
                        if (cell[0] >= 0 && cell[1] >= 0 && cell[2] >= 0 && cell[0] < n_grid && cell[1] < n_grid && cell[2] < n_grid) {
                            let weight = w[[i, 0]] * w[[j, 1]] * w[[k, 2]];
                            let id = ti.atomicAdd(grid[base + offset].numParticles, 1)
                            gridParticleIds[cell.concat([id])] = p
                            gridParticleWeights[cell.concat([id])] = weight
                        }
                    }
                }
            }
        }
        for (let I of ndrange(n_grid, n_grid, n_grid)) {
            let i = I[0];
            let j = I[1];
            let k = I[2];
            let numParticlesInCell = grid[[i, j, k]].numParticles

            let identity = [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0]
            ]

            for (let local_id of ti.range(numParticlesInCell)) {
                let p = gridParticleIds[i, j, k, local_id]
                let weight = gridParticleWeights[i, j, k, local_id]

                let stress = -dt * 4 * E * particleVol * (particles[p].J - 1) / dx ** 2
                let affine = stress * identity + particleMass * particles[p].C;
                let dpos = I * dx - particles[p].x
                grid[I].v = grid[I].v +
                    weight * (particleMass * particles[p].v + affine.matmul(dpos));
                grid[I].m = grid[I].m + weight * particleMass;
            }
        }
        for (let I of ndrange(n_grid, n_grid, n_grid)) {
            let bound = 2;
            let i = I[0];
            let j = I[1];
            let k = I[2];
            if (grid[I].m > 0) {
                grid[I].v = (1 / grid[I].m) * grid[I].v;
            }
            grid[I].v = grid[I].v + dt * gravity[0];
            if (i < bound && grid[I].v[0] < 0) {
                grid[I].v[0] = 0;
            }
            if (i >= n_grid - bound && grid[I].v[0] > 0) {
                grid[I].v[0] = 0;
            }
            if (j < bound && grid[I].v[1] < 0) {
                grid[I].v[1] = 0;
            }
            if (j >= n_grid - bound && grid[I].v[1] > 0) {
                grid[I].v[1] = 0;
            }
            if (k < bound && grid[I].v[2] < 0) {
                grid[I].v[2] = 0;
            }
            if (k >= n_grid - bound && grid[I].v[2] > 0) {
                grid[I].v[2] = 0;
            }
        }
        for (let p of range(numParticles)) {
            let Xp = particles[p].x / dx;
            let base = i32(Xp - 0.5);
            let fx = Xp - base;
            let w = [
                0.5 * (1.5 - fx) ** 2,
                0.75 - (fx - 1.0) ** 2,
                0.5 * (fx - 0.5) ** 2,
            ];
            let newVelocity = [0.0, 0.0, 0.0];
            let newC = [
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
                [0.0, 0.0, 0.0],
            ];
            for (let i of ti.static(ti.range(3))) {
                for (let j of ti.static(ti.range(3))) {
                    for (let k of ti.static(ti.range(3))) {
                        let offset = [i, j, k];
                        let dpos = (f32(offset) - fx) * dx;
                        let g_v = grid[base + offset].v;
                        let weight = w[[i, 0]] * w[[j, 1]] * w[[k, 2]];
                        newVelocity = newVelocity + weight * g_v;
                        newC = newC + (4 * weight * g_v.outer_product(dpos)) / (dx * dx);
                    }
                }
            }
            particles[p].v = newVelocity
            particles[p].C = newC
            particles[p].x = particles[p].x + dt * newVelocity
            particles[p].J = particles[p].J * (1 + dt * (newC[[0, 0]] + newC[[1, 1]] + newC[[2, 2]]))
        }
    });

    let reset_water_only = ti.kernel(() => {
        for (let p of range(numParticles)) {
            particles[p].x = [
                ti.random() * 0.4 + 0.05,
                ti.random() * 0.4 + 0.05,
                ti.random() * 0.4 + 0.05,
            ];
            particles[p].v = [0, 0, 0];
            particles[p].J = 1;
            particles[p].C = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
            ];
        }
    });

    let vertex_type = ti.types.struct({
        particle_pos: ti.types.vector(ti.f32, 3),
        vertex_pos: ti.types.vector(ti.f32, 2),
    });

    let VBO = ti.field(vertex_type, numParticles * 4);
    let IBO = ti.field(ti.i32, numParticles * 6);

    ti.addToKernelScope({ VBO, IBO });

    let init_vbo_ibo = ti.kernel(() => {
        for (let i of range(numParticles)) {
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

        }
    });

    let renderTarget = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    ti.addToKernelScope({ renderTarget, depth, aspectRatio });

    let render = ti.kernel(() => {
        for (let i of range(numParticles)) {
            for (let v of range(4)) {
                VBO[i * 4 + v].particle_pos = particles[i].x;
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
        for (let v of ti.inputVertices(VBO, IBO)) {
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
            });
        }
        // frag shader for vertices
        for (let f of ti.inputFragments()) {
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

            let mat_color = [0.1, 0.6, 0.9, 1.0];

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