import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 720;
    htmlCanvas.height = 360;

    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    let target = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    let scene = await ti.utils.ObjLoader.loadFromURL("../resources/PoolTable.obj")
    let sceneData = await scene.getKernelData()

    let cubemap = await ti.createCubeTextureFromURL([
        "../resources/skybox/right.jpg",
        "../resources/skybox/left.jpg",
        "../resources/skybox/top.jpg",
        "../resources/skybox/bottom.jpg",
        "../resources/skybox/front.jpg",
        "../resources/skybox/back.jpg"
    ])

    let cubeVBO = ti.field(ti.types.vector(ti.f32, 3), 8);
    let cubeIBO = ti.field(ti.i32, 36);
    await cubeVBO.fromArray([
        [-1, -1, -1],
        [-1, -1, 1],
        [-1, 1, -1],
        [-1, 1, 1],
        [1, -1, -1],
        [1, -1, 1],
        [1, 1, -1],
        [1, 1, 1],
    ]);
    await cubeIBO.fromArray([
        0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 0, 2, 4, 2, 6, 4, 1, 3, 5, 3, 7, 5, 0,
        1, 4, 1, 5, 4, 2, 3, 6, 3, 7, 6,
    ]);

    console.log(sceneData)
    ti.addToKernelScope({ sceneData, aspectRatio, target, depth, cubemap, cubeVBO, cubeIBO })

    let render = ti.kernel((t) => {
        let center = [0, 0, 0];
        let eye = [sin(t), 0.0, cos(t)] * 100 + [0.0, 50.0, 0.0] + center;
        let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
        let proj = ti.perspective(45.0, aspectRatio, 0.1, 1000);
        let vp = proj.matmul(view);

        ti.clearColor(target, [0.1, 0.2, 0.3, 1]);
        ti.useDepth(depth);
        for (let v of ti.inputVertices(cubeVBO, cubeIBO)) {
            let pos = vp.matmul((v * 500 + eye).concat([1.0]));
            ti.outputPosition(pos);
            ti.outputVertex(v);
        }
        for (let f of ti.inputFragments()) {
            let color = ti.textureSample(cubemap, f)
            color[3] = 1.0
            ti.outputColor(target, color);
        }
        for (let batchID of ti.static(ti.range(sceneData.batchesDrawInfoBuffers.length))) {
            for (let v of ti.inputVertices(sceneData.vertexBuffer, sceneData.indexBuffer, sceneData.batchesDrawInfoBuffers[batchID], sceneData.batchesDrawInfoBuffers[batchID].dimensions[0])) {
                let instanceIndex = ti.getInstanceIndex()
                let nodeIndex = sceneData.batchesDrawInstanceInfoBuffers[batchID][instanceIndex].nodeIndex
                let modelMatrix = sceneData.nodesBuffer[nodeIndex].globalTransform.matrix
                let mvp = vp.matmul(modelMatrix)
                let pos = mvp.matmul(v.position.concat([1.0]));
                ti.outputPosition(pos);
                ti.outputVertex(v);
            }
            for (let f of ti.inputFragments()) {
                //let baseColor = getMaterialBaseColor(f.texCoords, f.materialID)
                let normal = f.normal.normalized()
                let viewDir = (eye - f.position).normalized()
                //let color = baseColor * normal.dot([0.0, 1.0, 0.0])
                let reflected = normal * 2 * normal.dot(viewDir) - viewDir
                reflected = reflected.normalized()
                let color = ti.textureSample(cubemap, reflected)
                color[3] = 1.0
                ti.outputColor(target, color);
            }
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