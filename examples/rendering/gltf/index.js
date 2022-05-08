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
    //let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/FlightHelmet/glTF/FlightHelmet.gltf")


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
            let eye = [0.0, 0.0, 3.0];
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

            let lerp = (x, y, s) => {
                return x * (1.0 - s) + y * s
            }

            let distribution = (normal, halfDir, alpha) => {
                let numerator = alpha * alpha * characteristic(dot(normal, halfDir))
                let temp = dot(normal, halfDir) * dot(normal, halfDir) * (alpha * alpha - 1) + 1
                let denominator = Math.PI * temp * temp
                return numerator / denominator
            }

            let fresnel = (F0, normal, viewDir) => {
                return F0 + (1.0 - F0) * (1.0 - abs(dot(normal, viewDir))) ** 5
            }

            let evalSpecularBRDF = (alpha, Fr, normal, lightDir, viewDir, halfDir) => {
                let D = distribution(normal, halfDir, alpha)
                let NdotL = abs(dot(normal, lightDir))
                let NdotV = abs(dot(normal, viewDir))
                let G2_Over_4_NdotL_NdotV = 0.5 / lerp(2 * NdotL * NdotV, NdotL + NdotV, alpha)
                return G2_Over_4_NdotL_NdotV * D * Fr
            }

            let evalDiffuseBRDF = (albedo) => {
                return albedo * (1.0 / Math.PI)
            }

            let evalMetalBRDF = (alpha, baseColor, normal, lightDir, viewDir, halfDir) => {
                let F0 = baseColor
                let microfacetNormal = halfDir
                let Fr = fresnel(F0, microfacetNormal, viewDir)
                return evalSpecularBRDF(alpha, Fr, normal, lightDir, viewDir, halfDir)
            }

            let evalDielectricBRDF = (alpha, baseColor, normal, lightDir, viewDir, halfDir) => {
                let F0 = [0.04, 0.04, 0.04]
                let microfacetNormal = halfDir
                let Fr = fresnel(F0, microfacetNormal, viewDir)
                let specular = evalSpecularBRDF(alpha, Fr, normal, lightDir, viewDir, halfDir)
                let diffuse = evalDiffuseBRDF(baseColor)
                return diffuse * (1 - Fr) + specular
            }

            let evalBRDF = (material, normal, lightDir, viewDir, halfDir) => {
                let alpha = material.roughness * material.roughness
                let metallicBRDF = evalMetalBRDF(alpha, material.baseColor.rgb, normal, lightDir, viewDir, halfDir)
                let dielectricBRDF = evalDielectricBRDF(alpha, material.baseColor.rgb, normal, lightDir, viewDir, halfDir)
                return material.metallic * metallicBRDF + (1.0 - material.metallic) * dielectricBRDF
            }

            let getNormal = (normal, normalMap, texCoords, position) => {
                let uvDx = ti.dpdx(texCoords)
                let uvDy = ti.dpdy(texCoords)
                let posDx = ti.dpdx(position)
                let posDy = ti.dpdy(position)
                let temp = (uvDy.y * posDx - uvDx.y * posDy) / (uvDx.x * uvDy.y - uvDy.x * uvDx.y)
                let tangent = (temp - normal * dot(normal, temp))
                let bitangent = cross(normal, tangent)
                let mat = [tangent, bitangent, normal].transpose()
                let normalMapValue = (normalMap * 2.0 - 1.0).normalized()
                return ti.matmul(mat, normalMapValue).normalized()
            }

            for (let batchID of ti.static(ti.range(sceneData.batchesDrawInfoBuffers.length))) {
                let getMaterial = (texCoords, materialID) => {
                    let materialInfo = sceneData.materialInfoBuffer[materialID]
                    let material = {
                        baseColor: materialInfo.baseColor.value,
                        metallic: materialInfo.metallicRoughness.value[0],
                        roughness: materialInfo.metallicRoughness.value[1],
                        emissive: materialInfo.emissive.value,
                        normalMap: materialInfo.normalMap.value,
                    }
                    if (ti.static(scene.batchInfos[batchID].materialIndex != -1)) {
                        let materialRef = scene.materials[scene.batchInfos[batchID].materialIndex]
                        if (ti.static(materialRef.baseColor.texture !== undefined)) {
                            material.baseColor *= ti.textureSample(materialRef.baseColor.texture, texCoords)
                        }
                        if (ti.static(materialRef.metallicRoughness.texture !== undefined)) {
                            let metallicRoughness = ti.textureSample(materialRef.metallicRoughness.texture, texCoords)
                            material.metallic *= metallicRoughness[0]
                            material.roughness *= metallicRoughness[1]
                        }
                        if (ti.static(materialRef.emissive.texture !== undefined)) {
                            material.emissive *= ti.textureSample(materialRef.emissive.texture, texCoords).rgb
                        }
                        if (ti.static(materialRef.normalMap.texture !== undefined)) {
                            material.normalMap = ti.textureSample(materialRef.normalMap.texture, texCoords).rgb
                        }
                    }
                    return material
                }
                for (let v of ti.inputVertices(sceneData.vertexBuffer, sceneData.indexBuffer, sceneData.batchesDrawInfoBuffers[batchID], sceneData.batchesDrawInfoBuffers[batchID].dimensions[0])) {
                    let instanceIndex = ti.getInstanceIndex()
                    let instanceInfo = sceneData.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    let materialIndex = instanceInfo.materialIndex
                    let modelMatrix = sceneData.nodesBuffer[nodeIndex].globalTransform.matrix
                    let rotation = ti.rotateAxisAngle([0.0, 1.0, 0.0], t)
                    modelMatrix = ti.matmul(rotation, modelMatrix)
                    v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                    v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                    let pos = vp.matmul(v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    let vertexOutput = ti.mergeStructs(v, { materialIndex: materialIndex })
                    ti.outputVertex(vertexOutput);
                }
                for (let f of ti.inputFragments()) {
                    let materialID = f.materialIndex
                    let material = getMaterial(f.texCoords, materialID)
                    let normal = f.normal.normalized()
                    normal = getNormal(normal, material.normalMap, f.texCoords, f.position)
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
                        color += material.emissive
                        ti.outputColor(target, color.concat([1.0]));
                    }
                    else {
                        ti.outputColor(target, material.baseColor.concat([1.0]));
                    }
                }
            }
        }
    )
    let t = 100;
    async function frame() {
        render(t * 0.01);
        t = t + 1;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

};

main()
