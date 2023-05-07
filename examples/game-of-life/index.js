import * as ti from "../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let N = 128;

    let liveness = ti.field(ti.i32, [N, N])
    let numNeighbors = ti.field(ti.i32, [N, N])

    ti.addToKernelScope({ N, liveness, numNeighbors });

    let init = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            liveness[I] = 0
            let f = ti.random()
            if (f < 0.2) {
                liveness[I] = 1
            }
        }
    })
    await init()

    let countNeighbors = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let neighbors = 0
            for (let delta of ti.ndrange(3, 3)) {
                let J = (I + delta - 1) % N
                if ((J.x != I.x || J.y != I.y) && liveness[J] == 1) {
                    neighbors = neighbors + 1;
                }
            }
            numNeighbors[I] = neighbors
        }
    });
    let updateLiveness = ti.kernel(() => {
        for (let I of ti.ndrange(N, N)) {
            let neighbors = numNeighbors[I]
            if (liveness[I] == 1) {
                if (neighbors < 2 || neighbors > 3) {
                    liveness[I] = 0;
                }
            }
            else {
                if (neighbors == 3) {
                    liveness[I] = 1;
                }
            }
        }
    })

    let vertices = ti.field(ti.types.vector(ti.f32, 2), [6]);
    await vertices.fromArray([
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ]);

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 512;
    htmlCanvas.height = 512;
    let renderTarget = ti.canvasTexture(htmlCanvas);

    ti.addToKernelScope({ vertices, renderTarget });

    let render = ti.kernel(() => {
        ti.clearColor(renderTarget, [0.0, 0.0, 0.0, 1]);
        for (let v of ti.inputVertices(vertices)) {
            ti.outputPosition([v.x, v.y, 0.0, 1.0]);
            ti.outputVertex(v);
        }
        for (let f of ti.inputFragments()) {
            let coord = (f + 1) / 2.0;
            let texelIndex = ti.i32(coord * (liveness.dimensions - 1));
            let live = ti.f32(liveness[texelIndex]);
            ti.outputColor(renderTarget, [live, live, live, 1.0]);
        }
    });

    async function frame() {
        await countNeighbors()
        await updateLiveness()
        await render();
        requestAnimationFrame(frame);
    }
    await frame();
};

main()