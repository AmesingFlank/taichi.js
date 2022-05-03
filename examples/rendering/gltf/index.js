import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 1280;
    htmlCanvas.height = 720;

    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    let target = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb")
    let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF/Buggy.gltf")
    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Cube/glTF/Cube.gltf")

    let sceneData = await scene.getKernelData()

    console.log(scene)
    console.log(sceneData)
    for (let v of scene.vertices) {
        //console.log(v.position)
    }
    ti.addToKernelScope({ scene, sceneData, aspectRatio, target, depth })

    let render = ti.kernel(
        (t) => {
            let center = [0, 0, 0];
            let eye = [sin(t), 0.0, cos(t)] * 200 + [0.0, 200.0, 0.0] + center;
            let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
            let proj = ti.perspective(45.0, aspectRatio, 0.1, 1000);
            let vp = proj.matmul(view);


            ti.useDepth(depth);
            ti.clearColor(target, [0.1, 0.2, 0.3, 1]);

            for (let batchID of ti.static(ti.range(sceneData.batchesDrawInfoBuffers.length))) {
                let getMaterialBaseColor = (texCoords, materialID) => {
                    let materialInfo = sceneData.materialInfoBuffer[materialID]
                    let baseColor = materialInfo.baseColor.value
                    if (ti.static(scene.batchInfos[batchID].materialIndex != -1)) {
                        baseColor = baseColor * ti.textureSample(scene.materials[scene.batchInfos[batchID].materialIndex].baseColor.texture, texCoords)
                    }
                    return baseColor
                }
                for (let v of ti.inputVertices(sceneData.vertexBuffer, sceneData.indexBuffer, sceneData.batchesDrawInfoBuffers[batchID], sceneData.batchesDrawInfoBuffers[batchID].dimensions[0])) {
                    let instanceIndex = ti.getInstanceIndex()
                    let instanceInfo = sceneData.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    let materialIndex = instanceInfo.materialIndex
                    let modelMatrix = sceneData.nodesBuffer[nodeIndex].globalTransform.matrix
                    v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                    let mvp = vp.matmul(modelMatrix)
                    let pos = mvp.matmul(v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    let vertexOutput = ti.mergeStructs(v, { materialIndex: materialIndex })
                    ti.outputVertex(vertexOutput);
                }
                for (let f of ti.inputFragments()) {
                    let materialID = f.materialIndex
                    let baseColor = getMaterialBaseColor(f.texCoords, materialID)
                    let normal = f.normal.normalized()
                    let color = baseColor * (normal.dot([0.0, 1.0, 0.0]) + 0.3)
                    color[3] = 1.0
                    ti.outputColor(target, color);
                }
            }
        }
    )
    let t = 0;
    async function frame() {
        render(t * 0.01);
        t = t + 1;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

};

main()
