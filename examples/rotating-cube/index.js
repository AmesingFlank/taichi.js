import * as ti from '../../dist/taichi.js';
let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 720;
    htmlCanvas.height = 360;

    let vertices = ti.field(ti.types.vector(ti.f32, 3), 8);
    let indices = ti.field(ti.i32, 36);
    
    let renderTarget = ti.canvasTexture(htmlCanvas);
    let depthBuffer = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    ti.addToKernelScope({ vertices, renderTarget, indices, depthBuffer });

    await vertices.fromArray([
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
        [0, 1, 1],
        [1, 0, 0],
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1],
    ]);
    await indices.fromArray([
        0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 0, 2, 4, 2, 6, 4, 1, 3, 5, 3, 7, 5, 0, 1, 4, 1, 5, 4, 2, 3, 6, 3, 7, 6,
    ]);

    let render = ti.kernel((t) => {
        let center = [0.5, 0.5, 0.5];
        let eye = center + [ti.sin(t), 0.5, ti.cos(t)] * 2;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let aspectRatio = renderTarget.dimensions[0] / renderTarget.dimensions[1];
        let proj = ti.perspective(45.0, aspectRatio, 0.1, 100);
        let mvp = proj.matmul(view);

        ti.clearColor(renderTarget, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depthBuffer);

        for (let v of ti.inputVertices(vertices, indices)) {
            let pos = mvp.matmul(v.concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        for (let f of ti.inputFragments()) {
            let color = f.concat([1.0]);
            ti.outputColor(renderTarget, color);
        }
    });

    let i = 0;
    async function frame() {
        if (window.shouldStop) {
            return;
        }
        render(i * 0.03);
        i = i + 1;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
};

main();
