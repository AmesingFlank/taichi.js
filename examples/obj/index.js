import * as ti from "../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 720;
    htmlCanvas.height = 360; 
    
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    let target = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    let scene = await ti.utils.ObjLoader.loadFromURL("resources/PoolTable.obj")
    let sceneData = await scene.getKernelData()

    ti.addToKernelScope({sceneData, aspectRatio, target, depth})

    let render = ti.kernel((t) => {
        let center = [0,0,0];
        let eye = [sin(t), 0.0, cos(t)] * 100 + [0.0, 100.0, 0.0] + center;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(45.0, aspectRatio, 0.1, 1000);
        let mvp = proj.matmul(view);

        ti.clearColor(target, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depth);

        for (let v of ti.inputVertices(sceneData.vertexBuffer, sceneData.indexBuffer)) {
            let pos = mvp.matmul(v.position.concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        for (let f of ti.inputFragments()) {
            let normal = f.normal.normalized()
            let c = normal.dot([0.0,1.0,0.0]) * 0.7
            let color = [c,c,c,1.0];
            ti.outputColor(target, color);
        }
    });

    let i = 0;
    async function frame() {
        render(i * 0.01);
        i = i + 1;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
 
};

main()