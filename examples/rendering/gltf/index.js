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
    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb")
    let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF/DamagedHelmet.gltf")


    scene.lights.push(new ti.utils.LightInfo(
        ti.utils.LightType.Point,
        [300, 300, 300],
        1000000,
        [1, 1, 1],
        1000
    ))
    scene.lights.push(new ti.utils.LightInfo(
        ti.utils.LightType.Point,
        [-300, -300, -300],
        1000000,
        [1, 1, 1],
        1000
    ))

    console.log(scene)

    let sceneData = await scene.getKernelData()
    console.log(sceneData)

    ti.addToKernelScope({ scene, sceneData, aspectRatio, target, depth, LightType: ti.utils.LightType })

    let render = ti.kernel(
        (t) => {
            let center = [0, 0, 0];
            let eye = [sin(t), 0.0, cos(t)] * 5 + [0.0, 0.0, 0.0] + center;
            let view = ti.lookAt(eye, center, [0.0, 1.0, 0.0]);
            let proj = ti.perspective(45.0, aspectRatio, 0.1, 1000);
            let vp = proj.matmul(view); 

            ti.useDepth(depth);
            ti.clearColor(target, [0.1, 0.2, 0.3, 1]);

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

            let characteristic = (x) => {
                let result = 1
                if (x < 0) {
                    result = 0
                }
                return result
            }

            let geometry = (alphaSquared, normal, lightDir, viewDir, halfDir) => {
                let G1 = (dir) => {
                    let numerator = 2.0 * abs(dot(dir, normal)) * characteristic(dot(halfDir, dir))
                    let denominator = abs(dot(dir, normal)) + sqrt(alphaSquared + (1 - alphaSquared) * dot(normal, dir) * dot(normal, dir))
                    return numerator / denominator
                }
                return G1(lightDir) * G1(viewDir)
            }

            let distribution = (normal, halfDir, alphaSquared) => {
                let numerator = alphaSquared * characteristic(dot(normal, halfDir))
                let temp = dot(normal, halfDir) * dot(normal, halfDir) * (alphaSquared - 1) + 1
                let denominator = Math.PI * temp * temp
                return numerator / denominator
            }

            let fresnel = (F0, normal, viewDir) => {
                return F0 + (1.0 - F0) * (1.0 - abs(dot(normal, viewDir))) ** 5
            }

            let evalSpecularBRDF = (alphaSquared, Fr, normal, lightDir, viewDir, halfDir) => {
                let G = geometry(alphaSquared, normal, lightDir, viewDir, halfDir)
                let D = distribution(normal, halfDir, alphaSquared)
                return G * D * Fr / (4 * dot(normal, viewDir) * dot(normal, lightDir))
            }

            let evalDiffuseBRDF = (albedo) => {
                return albedo * (1.0 / Math.PI)
            }

            let evalMetalBRDF = (alphaSquared, baseColor, normal, lightDir, viewDir, halfDir) => {
                let F0 = baseColor
                let microfacetNormal = halfDir
                let Fr = fresnel(F0, microfacetNormal, viewDir)
                return evalSpecularBRDF(alphaSquared, Fr, normal, lightDir, viewDir, halfDir)
            }

            let evalDielectricBRDF = (alphaSquared, baseColor, normal, lightDir, viewDir, halfDir) => {
                let F0 = [0.04, 0.04, 0.04]
                let microfacetNormal = halfDir
                let Fr = fresnel(F0, microfacetNormal, viewDir)
                let specular = evalSpecularBRDF(alphaSquared, Fr, normal, lightDir, viewDir, halfDir)
                let diffuse = evalDiffuseBRDF(baseColor)
                return diffuse * (1 - Fr) + specular
            }

            let evalBRDF = (material, normal, lightDir, viewDir, halfDir) => {
                let alpha = material.roughness * material.roughness
                let alphaSquared = alpha * alpha
                let metallicBRDF = evalMetalBRDF(alphaSquared, material.baseColor.rgb, normal, lightDir, viewDir, halfDir)
                let dielectricBRDF = evalDielectricBRDF(alphaSquared, material.baseColor.rgb, normal, lightDir, viewDir, halfDir)
                return material.metallic * metallicBRDF + (1.0 - material.metallic) * dielectricBRDF
            }

            for (let batchID of ti.static(ti.range(sceneData.batchesDrawInfoBuffers.length))) {
                let getMaterial = (texCoords, materialID) => {
                    let materialInfo = sceneData.materialInfoBuffer[materialID]
                    let material = {
                        baseColor: materialInfo.baseColor.value,
                        metallic: materialInfo.metallicRoughness.value[0],
                        roughness: materialInfo.metallicRoughness.value[1]
                    }
                    if (ti.static(scene.batchInfos[batchID].materialIndex != -1)) {
                        material.baseColor *= ti.textureSample(scene.materials[scene.batchInfos[batchID].materialIndex].baseColor.texture, texCoords)
                        material.metallic *= ti.textureSample(scene.materials[scene.batchInfos[batchID].materialIndex].metallicRoughness.texture, texCoords)[0]
                        material.roughness *= ti.textureSample(scene.materials[scene.batchInfos[batchID].materialIndex].metallicRoughness.texture, texCoords)[1]
                    }
                    return material
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
                    let material = getMaterial(f.texCoords, materialID)
                    let viewDir = (eye - f.position).normalized()

                    if (ti.static(scene.lights.length > 0)) {
                        let color = [0.0, 0.0, 0.0]
                        for (let i of range(scene.lights.length)) {
                            let light = sceneData.lightsInfoBuffer[i]
                            let fragToLight = light.position - f.position
                            let brightness = getLightBrightness(light, fragToLight)
                            let lightDir = fragToLight.normalized()
                            let halfDir = (lightDir + viewDir).normalized()
                            let brdf = evalBRDF(material, normal, lightDir, viewDir, halfDir)
                            color = color + brightness * brdf
                        }
                        ti.outputColor(target, color.concat([1.0]));
                    }
                    else {
                        ti.outputColor(target, material.baseColor.concat([1.0]));
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
