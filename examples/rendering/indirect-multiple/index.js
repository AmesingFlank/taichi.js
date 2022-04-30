import * as ti from "../../../dist/taichi.dev.js"
let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 720;
    htmlCanvas.height = 360;

    let indirectType = ti.types.struct({
        indexCount: ti.i32,
        instanceCount: ti.i32,
        firstIndex: ti.i32,
        baseVertex: ti.i32,
        firstInstance: ti.i32
    })

    let indirectBuffer = ti.field(indirectType, 12)

    let VBO = ti.field(ti.types.vector(ti.f32, 3), 8);
    let IBO = ti.field(ti.i32, 36);
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;
    let target = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    ti.addToKernelScope({ VBO, target, IBO, aspectRatio, depth, indirectBuffer });

    await VBO.fromArray([
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 0],
        [0, 1, 1],
        [1, 0, 0],
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1],
    ]);
    await IBO.fromArray([
        0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 0, 2, 4, 2, 6, 4, 1, 3, 5, 3, 7, 5, 0,
        1, 4, 1, 5, 4, 2, 3, 6, 3, 7, 6,
    ]);

    let render = ti.kernel((t) => {
        let center = [0.5, 0.5, 0.5];
        let eye = center + [ti.sin(t), 0.5, ti.cos(t)] * 2;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(45.0, aspectRatio, 0.1, 100);
        let mvp = proj.matmul(view);

        for (let i of range(12)) {
            indirectBuffer[i] = {
                indexCount: 3,
                instanceCount: 1,
                firstIndex: 3 * i,
                baseVertex: 0,
                firstInstance: 0
            }
        } 

        ti.clearColor(target, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depth);

        for (let v of ti.inputVertices(VBO, IBO, indirectBuffer, 12)) {
            let pos = mvp.matmul(v.concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        for (let f of ti.inputFragments()) {
            let color = f.concat([1.0]);
            ti.outputColor(target, color);
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

main()