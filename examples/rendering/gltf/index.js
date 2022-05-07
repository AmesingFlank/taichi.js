import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 1280;
    htmlCanvas.height = 720;

    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    let target = ti.canvasTexture(htmlCanvas, 4);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height], 4);

    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF-Binary/Buggy.glb")
    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Buggy/glTF/Buggy.gltf")
    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Cube/glTF/Cube.gltf")
    let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb")


    scene.lights.push(new ti.utils.LightInfo(
        ti.utils.LightType.Point,
        [300, 300, 300],
        1000000,
        [1, 1, 1],
        1000
    ))

    let sceneData = await scene.getKernelData()

    console.log(sceneData)
    ti.addToKernelScope({ scene, sceneData, aspectRatio, target, depth, LightType: ti.utils.LightType })

    let render = ti.kernel(
        (t) => {
            let center = [0, 0, 0];
            let eye = [sin(t), 0.0, cos(t)] * 10 + [0.0, 10.0, 0.0] + center;
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
                let getLightBrightness = (light, fragToLight) => {
                    let brightness = [0.0, 0.0, 0.0]
                    if (light.type === LightType.Point) {
                        let distance = fragToLight.norm()
                        let attenuation = 1.0 / (ti.max(distance * distance, 0.01 * 0.01))
                        let window = (1 - (distance / light.influenceRadius) ** 2) ** 4
                        brightness = light.brightness * attenuation * window
                    }
                    return brightness
                }
                for (let v of ti.inputVertices(sceneData.vertexBuffer, sceneData.indexBuffer, sceneData.batchesDrawInfoBuffers[batchID], sceneData.batchesDrawInfoBuffers[batchID].dimensions[0])) {
                    let instanceIndex = ti.getInstanceIndex()
                    let instanceInfo = sceneData.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    let materialIndex = instanceInfo.materialIndex
                    let modelMatrix = sceneData.nodesBuffer[nodeIndex].globalTransform.matrix
                    v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                    v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                    let pos = vp.matmul(v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    let vertexOutput = ti.mergeStructs(v, { materialIndex: materialIndex })
                    ti.outputVertex(vertexOutput);
                }
                for (let f of ti.inputFragments()) {
                    let normal = f.normal.normalized()
                    let materialID = f.materialIndex
                    let baseColor = getMaterialBaseColor(f.texCoords, materialID).rgb

                    if (ti.static(scene.lights.length > 0)) {
                        let color = [0.0, 0.0, 0.0]
                        for (let i of range(scene.lights.length)) {
                            let light = sceneData.lightsInfoBuffer[i]
                            let fragToLight = light.position - f.position
                            let brightness = getLightBrightness(light, fragToLight)
                            color = color + brightness * normal.dot(fragToLight.normalized()) * baseColor
                        }
                        ti.outputColor(target, color.concat([1.0]));
                    }
                    else {
                        ti.outputColor(target, baseColor.concat([1.0]));
                    }
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
