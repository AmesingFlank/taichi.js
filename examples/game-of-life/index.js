import * as ti from "../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let N = 128;

    let cells = ti.field(ti.i32, [N, N])

    ti.addToKernelScope({ N, cells });

    let init = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            cells[I] = 0
            let f = ti.random()
            if (f < 0.1) {
                cells[I] = 1
            }
        }
    })
    await init()

    let step = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let neighbors = 0
            for (let delta of ti.ndrange(2, 2)) {
                let J = I + delta - [1, 1]
                if (J.x < 0 || J.y >= N) {
                    continue;
                }
                if (cells[J] == 1) {
                    neighbors = neighbors + 1;
                }
            }
            if (cells[I] == 1) {
                if (neighbors < 2 || neighbors > 3) {
                    cells[I] = 0;
                }
            }
            else {
                if (neighbors == 3) {
                    cells[I] = 1;
                }
            }
        }
    });

    let vertices = ti.field(ti.types.vector(ti.f32, 2), [4])
    await vertices.fromArray([
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ]);
    let indices = ti.field(ti.i32, [6])
    await indices.fromArray([0, 1, 2, 1, 3, 2]);

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;
    let renderTarget = ti.canvasTexture(htmlCanvas)

    ti.addToKernelScope({ vertices, indices, renderTarget });

    let render = ti.kernel(
        () => {
            ti.clearColor(renderTarget, [0.0, 0.0, 0.0, 1]);
            for (let v of ti.inputVertices(vertices, indices)) {
                ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                ti.outputVertex(v);
            }
            for (let f of ti.inputFragments()) {
                let coord = (f + 1) / 2.0
                let texelIndex = ti.i32(coord * (cells.dimensions - 1))
                let live = ti.f32(cells[texelIndex])
                ti.outputColor(renderTarget, [live, live, live, 1.0])
            }
        }
    )


    async function frame() {
        await step()
        await render();
        requestAnimationFrame(frame);
    }
    await frame();
};

main()