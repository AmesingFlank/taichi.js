import * as ti from "../../dist/taichi.js"
let main = async () => {
    await ti.init();

    let tile_size = 8;
    let width = 512;
    let height = 512;
    let num_triangles = 60;
    let num_samples_per_pixel = 4;
    let num_spp_sqrt = Math.floor(Math.sqrt(num_samples_per_pixel));

    let samples = ti.Vector.field(4, ti.f32, [
        width,
        height,
        num_spp_sqrt,
        num_spp_sqrt,
    ]);
    let pixels = ti.Vector.field(4, ti.f32, [width, height]);

    let A = ti.Vector.field(2, ti.f32, [num_triangles]);
    let B = ti.Vector.field(2, ti.f32, [num_triangles]);
    let C = ti.Vector.field(2, ti.f32, [num_triangles]);
    let c0 = ti.Vector.field(3, ti.f32, [num_triangles]);
    let c1 = ti.Vector.field(3, ti.f32, [num_triangles]);
    let c2 = ti.Vector.field(3, ti.f32, [num_triangles]);

    let block_num_triangles = ti.field(ti.i32, [
        width / tile_size,
        height / tile_size,
    ]);
    let block_indicies = ti.field(ti.i32, [
        width / tile_size,
        height / tile_size,
        num_triangles,
    ]);

    let point_in_triangle = (P, A, B, C) => {
        let alpha = -(P.x - B.x) * (C.y - B.y) + (P.y - B.y) * (C.x - B.x);
        alpha = alpha / (-(A.x - B.x) * (C.y - B.y) + (A.y - B.y) * (C.x - B.x));
        let beta = -(P.x - C.x) * (A.y - C.y) + (P.y - C.y) * (A.x - C.x);
        beta = beta / (-(B.x - C.x) * (A.y - C.y) + (B.y - C.y) * (A.x - C.x));
        let gamma = 1.0 - alpha - beta;
        let result =
            alpha >= 0.0 &&
            alpha <= 1.0 &&
            beta >= 0.0 &&
            beta <= 1.0 &&
            gamma >= 0.0;
        return [result, alpha, beta, gamma];
    };

    let bbox_intersect = (A0, A1, B0, B1) =>
        B0.x < A1.x && B0.y < A1.y && B1.x > A0.x && B1.y > A0.y;

    let num_blocks_x = width / tile_size;
    let num_blocks_y = height / tile_size;

    ti.addToKernelScope({
        tile_size,
        width,
        height,
        num_triangles,
        num_samples_per_pixel,
        num_spp_sqrt,
        samples,
        pixels,
        A,
        B,
        C,
        c0,
        c1,
        c2,
        block_num_triangles,
        block_indicies,
        point_in_triangle,
        bbox_intersect,
        num_blocks_x,
        num_blocks_y,
    });

    let vec2 = ti.types.vector(ti.f32, 2);
    let vec3 = ti.types.vector(ti.f32, 3);

    let tile_culling = ti.kernel(() => {
        for (let t of range(num_triangles)) {
            let tri_min = ti.min(A[t], ti.min(B[t], C[t]));
            let tri_max = ti.max(A[t], ti.max(B[t], C[t]));
            for (let I of ndrange(num_blocks_x, num_blocks_y)) {
                let i = I[0];
                let j = I[1];
                let idx = 0;
                let tile_min = [i * tile_size, j * tile_size];
                let tile_max = [(i + 1) * tile_size, (j + 1) * tile_size];
                if (bbox_intersect(tile_min, tile_max, tri_min, tri_max)) {
                    let my_idx = ti.atomicAdd(block_num_triangles[(i, j)], 1);
                    block_indicies[[i, j, my_idx]] = t;
                }
            }
        }
    });

    let rasterize = ti.kernel(() => {
        for (let I of ndrange(width, height)) {
            let i = I[0];
            let j = I[1];
            let block_i = i32(i / tile_size);
            let block_j = i32(j / tile_size);
            let this_block_num = block_num_triangles[(block_i, block_j)];
            for (let k of range(this_block_num)) {
                let idx = block_indicies[(block_i, block_j, k)];
                for (let sub of ndrange(num_spp_sqrt, num_spp_sqrt)) {
                    let subi = sub[0];
                    let subj = sub[1];
                    let P = [
                        i + (subi + 0.5) / num_spp_sqrt,
                        j + (subj + 0.5) / num_spp_sqrt,
                    ];
                    let point_info = point_in_triangle(P, A[idx], B[idx], C[idx]);
                    if (point_info[0]) {
                        let color =
                            c0[idx] * point_info[1] +
                            c1[idx] * point_info[2] +
                            c2[idx] * point_info[3];
                        if (idx > samples[[i, j, subi, subj]].w) {
                            samples[[i, j, subi, subj]] = (color, idx);
                        }
                    }
                }
            }
            let samples_sum = [0.0, 0.0, 0.0];
            for (let sub of ndrange(num_spp_sqrt, num_spp_sqrt)) {
                let subi = sub[0];
                let subj = sub[1];
                samples_sum = samples_sum + samples[(i, j, subi, subj)].rgb;
            }
            pixels[[i, j]] = (samples_sum / num_samples_per_pixel, 1);
        }
    });
    let fill_all = ti.kernel(() => {
        for (let I of ndrange(num_blocks_x, num_blocks_y)) {
            block_num_triangles[I] = 0;
        }
        for (let I of ndrange(width, height)) {
            let i = I[0];
            let j = I[1];
            for (let sub of ndrange(num_spp_sqrt, num_spp_sqrt)) {
                let subi = sub[0];
                let subj = sub[1];
                samples[[i, j, subi, subj]] = [1, 1, 1, -1];
            }
        }
    });

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = width;
    htmlCanvas.height = height;
    let canvas = new ti.Canvas(htmlCanvas);

    let i = 0;
    async function frame() {
        if (window.shouldStop) {
            return;
        }
        let updated_triangle = i % num_triangles;
        A.set([updated_triangle], [Math.random() * width, Math.random() * height]);
        B.set([updated_triangle], [Math.random() * width, Math.random() * height]);
        C.set([updated_triangle], [Math.random() * width, Math.random() * height]);
        c0.set([updated_triangle], [Math.random(), Math.random(), Math.random()]);
        c1.set([updated_triangle], [Math.random(), Math.random(), Math.random()]);
        c2.set([updated_triangle], [Math.random(), Math.random(), Math.random()]);

        fill_all();
        tile_culling();
        rasterize();
        i = i + 1;
        canvas.setImage(pixels);
        requestAnimationFrame(frame);
    }
    await frame();
};
main()