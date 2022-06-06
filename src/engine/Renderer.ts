import { Field } from "../data/Field";
import { CanvasTexture, DepthTexture, TextureBase } from "../data/Texture";
import * as ti from "../taichi"
import { BatchInfo } from "./BatchInfo";
import { Camera } from "./Camera";
import { DrawInfo } from "./DrawInfo";
import { InstanceInfo } from "./InstanceInfo";
import { Scene, SceneData } from "./Scene";

export class Renderer {
    public constructor(public scene: Scene, public htmlCanvas: HTMLCanvasElement) {
        this.depthTexture = ti.depthTexture([htmlCanvas.width, htmlCanvas.height], 4);
        this.canvasTexture = ti.canvasTexture(htmlCanvas, 4)
    }

    renderKernel: ((...args: any[]) => any) = () => { }
    depthTexture: DepthTexture
    canvasTexture: CanvasTexture

    sceneData?: SceneData

    skyboxVBO?: Field
    skyboxIBO?: Field

    iblLambertianFiltered?: TextureBase
    iblGGXFiltered?: TextureBase
    LUT?: TextureBase

    batchInfos: BatchInfo[] = []
    batchesDrawInfos: DrawInfo[][] = []
    batchesDrawInstanceInfos: InstanceInfo[][] = []

    batchesDrawInfoBuffers: Field[] = []
    batchesDrawInstanceInfoBuffers: Field[] = []

    uvToDir = ti.func(
        (uv: any) => {
            let y = Math.cos((1.0 - uv[1]) * Math.PI)
            let phi = (uv[0] - 0.5) * Math.PI / 0.5
            let absZOverX = Math.abs(Math.tan(phi))
            let xSquared = (1.0 - y * y) / (1.0 + absZOverX * absZOverX)
            let x = Math.sqrt(xSquared)
            let z = x * absZOverX
            if (Math.abs(phi) >= Math.PI * 0.5) {
                x = -x;
            }
            if (phi < 0) {
                z = -z;
            }
            return [x, y, z]
        }
    )

    dirToUV = ti.func(
        (dir: any) => {
            return [0.5 + 0.5 * Math.atan2(dir[2], dir[0]) / Math.PI, 1.0 - Math.acos(dir[1]) / Math.PI]
        }
    )

    tonemap = ti.func(
        (color: any, exposure: any) => {
            let A = 2.51;
            let B = 0.03;
            let C = 2.43;
            let D = 0.59;
            let E = 0.14;
            let temp = color * exposure
            temp = (temp * (A * temp + B)) / (temp * (C * temp + D) + E)
            return Math.max(0.0, Math.min(1.0, temp))
        }
    )

    characteristic = ti.func(
        (x: any) => {
            let result = 1
            if (x < 0) {
                result = 0
            }
            return result
        }
    )

    ggxDistribution = ti.func(
        (NdotH: any, alpha: any) => {
            let numerator = alpha * alpha * this.characteristic(NdotH)
            let temp = NdotH * NdotH * (alpha * alpha - 1) + 1
            let denominator = Math.PI * temp * temp
            return numerator / denominator
        }
    )


    async init() {
        this.sceneData = await this.scene.getKernelData()
        await this.computeDrawBatches()

        console.log(this)

        if (this.scene.ibl) {

            this.iblLambertianFiltered = ti.texture(4, this.scene.ibl.texture.dimensions)
            this.iblGGXFiltered = ti.texture(4, this.scene.ibl.texture.dimensions.concat([16]), 1, { wrapModeW: ti.WrapMode.ClampToEdge })
            this.LUT = ti.texture(4, [512, 512], 1, { wrapModeU: ti.WrapMode.ClampToEdge, wrapModeV: ti.WrapMode.ClampToEdge })
            this.skyboxVBO = ti.field(ti.types.vector(ti.f32, 3), 8);
            this.skyboxIBO = ti.field(ti.i32, 36);

            await this.skyboxVBO.fromArray([
                [-1, -1, -1],
                [-1, -1, 1],
                [-1, 1, -1],
                [-1, 1, 1],
                [1, -1, -1],
                [1, -1, 1],
                [1, 1, -1],
                [1, 1, 1],
            ]);
            await this.skyboxIBO.fromArray([
                0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6, 0, 2, 4, 2, 6, 4, 1, 3, 5, 3, 7, 5, 0,
                1, 4, 1, 5, 4, 2, 3, 6, 3, 7, 6,
            ]);

            let prefilterKernel = ti.classKernel(
                this,
                () => {
                    let kSampleCount = 1024

                    let radicalInverseVdC = (bits) => {
                        bits = (bits << 16) | (bits >>> 16);
                        bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >>> 1);
                        bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >>> 2);
                        bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >>> 4);
                        bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >>> 8);
                        let result = f32(bits) * 2.3283064365386963e-10;
                        if (bits < 0) {
                            result = 1.0 + f32(bits) * 2.3283064365386963e-10;
                        }
                        return result
                    }

                    let hammersley2d = (i, N) => {
                        return [f32(i) / N, radicalInverseVdC(i32(i))];
                    }

                    let generateTBN = (normal) => {
                        let bitangent = [0.0, 1.0, 0.0];

                        let NdotUp = dot(normal, [0.0, 1.0, 0.0]);
                        let epsilon = 0.0000001;
                        if (1.0 - abs(NdotUp) <= epsilon) {
                            // Sampling +Y or -Y, so we need a more robust bitangent.
                            if (NdotUp > 0.0) {
                                bitangent = [0.0, 0.0, 1.0];
                            }
                            else {
                                bitangent = [0.0, 0.0, -1.0];
                            }
                        }

                        let tangent = normalized(cross(bitangent, normal));
                        bitangent = cross(normal, tangent);

                        return [tangent, bitangent, normal].transpose();
                    }

                    let computeLod = (pdf) => {
                        return 0.5 * log(6.0 * this.scene.ibl.texture.dimensions[0] * this.scene.ibl.texture.dimensions[0] / (kSampleCount * pdf)) / log(2.0);
                    }

                    let getLambertianImportanceSample = (normal, xi) => {
                        let cosTheta = sqrt(1.0 - xi.y);
                        let sinTheta = sqrt(xi.y);
                        let phi = 2.0 * Math.PI * xi.x;
                        let localSpaceDirection = [
                            sinTheta * cos(phi),
                            sinTheta * sin(phi),
                            cosTheta
                        ]
                        let TBN = generateTBN(normal);
                        let direction = TBN.matmul(localSpaceDirection);
                        return {
                            pdf: cosTheta / Math.PI,
                            direction: direction
                        }
                    }

                    let filterLambertian = (normal) => {
                        let color = [0.0, 0.0, 0.0]
                        for (let i of range(kSampleCount)) {
                            let xi = hammersley2d(i, kSampleCount)
                            let importanceSample = getLambertianImportanceSample(normal, xi)
                            let halfDir = importanceSample.direction
                            let pdf = importanceSample.pdf
                            let lod = computeLod(pdf);
                            let halfDirCoords = this.dirToUV(halfDir)
                            let sampled = ti.textureSampleLod(this.scene.ibl.texture, halfDirCoords, lod)
                            color += sampled.rgb / kSampleCount
                        }
                        return color
                    }

                    for (let I of ti.ndrange(this.iblLambertianFiltered.dimensions[0], this.iblLambertianFiltered.dimensions[1])) {
                        let uv = I / (this.iblLambertianFiltered.dimensions - [1.0, 1.0])
                        let dir = this.uvToDir(uv)
                        let filtered = filterLambertian(dir)
                        ti.textureStore(this.iblLambertianFiltered, I, filtered.concat([1.0]));
                    }

                    let saturate = (v) => {
                        return max(0.0, min(1.0, v))
                    }

                    let getGGXImportanceSample = (normal, roughness, xi) => {
                        let alpha = roughness * roughness;
                        let cosTheta = saturate(sqrt((1.0 - xi.y) / (1.0 + (alpha * alpha - 1.0) * xi.y)));
                        let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
                        let phi = 2.0 * Math.PI * xi.x;

                        let pdf = this.ggxDistribution(cosTheta, alpha) / 4.0;
                        let localSpaceDirection = [
                            sinTheta * cos(phi),
                            sinTheta * sin(phi),
                            cosTheta
                        ]
                        let TBN = generateTBN(normal);
                        let direction = TBN.matmul(localSpaceDirection);
                        return {
                            pdf: pdf,
                            direction: direction
                        }
                    }

                    let filterGGX = (normal, roughness) => {
                        let color = [0.0, 0.0, 0.0]
                        for (let i of range(kSampleCount)) {
                            let xi = hammersley2d(i, kSampleCount)
                            let importanceSample = getGGXImportanceSample(normal, roughness, xi)
                            let halfDir = importanceSample.direction
                            let pdf = importanceSample.pdf
                            let lod = computeLod(pdf);
                            if (roughness == 0.0) {
                                lod = 0.0
                            }
                            let halfDirCoords = this.dirToUV(halfDir)
                            let sampled = ti.textureSampleLod(this.scene.ibl.texture, halfDirCoords, lod)
                            color += sampled.rgb / kSampleCount
                        }
                        return color
                    }

                    for (let I of ti.ndrange(this.iblGGXFiltered.dimensions[0], this.iblGGXFiltered.dimensions[1])) {
                        let numLevels = this.iblGGXFiltered.dimensions[2]
                        for (let level of range(numLevels)) {
                            let roughness = level / (numLevels - 1)
                            let uv = I / (this.iblGGXFiltered.dimensions.slice(0, 2) - [1.0, 1.0])
                            let dir = this.uvToDir(uv)
                            let filtered = filterGGX(dir, roughness)
                            ti.textureStore(this.iblGGXFiltered, I.concat([level]), filtered.concat([1.0]));
                        }
                    }

                    let computeLUT = (NdotV, roughness) => {
                        let V = [sqrt(1.0 - NdotV * NdotV), 0.0, NdotV];
                        let N = [0.0, 0.0, 1.0];

                        let A = 0.0;
                        let B = 0.0;
                        let C = 0.0;

                        for (let i of range(kSampleCount)) {
                            let xi = hammersley2d(i, kSampleCount)
                            let importanceSample = getGGXImportanceSample(N, roughness, xi)
                            let H = importanceSample.direction;
                            // float pdf = importanceSample.w;
                            let L = (2.0 * H * dot(H, V) - V).normalized()

                            let NdotL = saturate(L.z);
                            let NdotH = saturate(H.z);
                            let VdotH = saturate(dot(V, H));

                            if (NdotL > 0.0) {
                                let a2 = Math.pow(roughness, 4.0);
                                let GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2);
                                let GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2);
                                let V_pdf = (0.5 / (GGXV + GGXL)) * VdotH * NdotL / NdotH;
                                let Fc = Math.pow(1.0 - VdotH, 5.0);
                                A += (1.0 - Fc) * V_pdf;
                                B += Fc * V_pdf;
                                C += 0.0;

                            }
                        }
                        return [4.0 * A, 4.0 * B, 4.0 * 2.0 * Math.PI * C] / kSampleCount;
                    }

                    for (let I of ti.ndrange(this.LUT.dimensions[0], this.LUT.dimensions[1])) {
                        let uv = I / (this.LUT.dimensions - [1.0, 1.0])
                        let texel = computeLUT(uv[0], uv[1])
                        ti.textureStore(this.LUT, I, texel.concat([1.0]));
                    }
                },
                undefined
            )
            await prefilterKernel()
        }

        this.renderKernel = ti.classKernel(this,
            { camera: Camera.getKernelType() },
                        (camera) => { 
                let view = ti.lookAt(camera.position, camera.position + camera.direction, camera.up);
                let aspectRatio = this.htmlCanvas.width / this.htmlCanvas.height
                let proj = ti.perspective(camera.fov, aspectRatio, camera.near, camera.far);
                let vp = proj.matmul(view);

                ti.useDepth(this.depthTexture);
                ti.clearColor(this.canvasTexture, [0.1, 0.2, 0.3, 1]);

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

                let lerp = (x, y, s) => {
                    return x * (1.0 - s) + y * s
                }

                let linearTosRGB = (x) => {
                    return Math.pow(x, 1.0 / 2.2)
                }

                let sRGBToLinear = (x) => {
                    return Math.pow(x, 2.2)
                }

                let fresnel = (F0, normal, viewDir) => {
                    return F0 + (1.0 - F0) * (1.0 - abs(dot(normal, viewDir))) ** 5
                }

                let evalSpecularBRDF = (alpha, Fr, normal, lightDir, viewDir, halfDir) => {
                    let D = this.ggxDistribution(dot(normal, halfDir), alpha)
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

                let dielectricF0 = [0.04, 0.04, 0.04]

                let evalDielectricBRDF = (alpha, baseColor, normal, lightDir, viewDir, halfDir) => {
                    let microfacetNormal = halfDir
                    let Fr = fresnel(dielectricF0, microfacetNormal, viewDir)
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

                let evalIBL = (material, normal, viewDir) => {
                    let result = [0.0, 0.0, 0.0]
                    if(ti.static(this.scene.ibl !== undefined)){
                        let diffuseColor = (1.0 - material.metallic) * (1.0 - dielectricF0) * material.baseColor.rgb
                        let normalUV = this.dirToUV(normal)
                        let diffuseLight = sRGBToLinear(this.tonemap(ti.textureSample(this.iblLambertianFiltered, normalUV).rgb, this.scene.ibl.exposure))
                        let diffuse = diffuseColor * diffuseLight

                        let specularColor = (1.0 - material.metallic) * dielectricF0 + material.metallic * material.baseColor.rgb
                        let reflection = normalized(2.0 * normal * dot(normal, viewDir) - viewDir)
                        let reflectionUV = this.dirToUV(reflection)
                        let specularLight = sRGBToLinear(this.tonemap(ti.textureSample(this.iblGGXFiltered, reflectionUV.concat([material.roughness])).rgb, this.scene.ibl.exposure))
                        let NdotV = dot(normal, viewDir)
                        let scaleBias = ti.textureSample(this.LUT, [NdotV, material.roughness]).rg
                        let specular = specularLight * (specularColor * scaleBias[0] + scaleBias[1])

                        result = specular + diffuse
                    }
                    return result
                }

                let getNormal = (normal, normalMap, texCoords, position) => {
                    let uvDx = ti.dpdx(texCoords.concat([0.0]))
                    let uvDy = ti.dpdy(texCoords.concat([0.0]))
                    let posDx = ti.dpdx(position)
                    let posDy = ti.dpdy(position)
                    let temp = (uvDy.y * posDx - uvDx.y * posDy) / (uvDx.x * uvDy.y - uvDy.x * uvDx.y)
                    let tangent = (temp - normal * dot(normal, temp)).normalized()
                    let bitangent = cross(normal, tangent).normalized()
                    let mat = [tangent, bitangent, normal].transpose()
                    let normalMapValue = (normalMap * 2.0 - 1.0).normalized()
                    return ti.matmul(mat, normalMapValue).normalized()
                }

                for (let batchID of ti.static(ti.range(this.batchesDrawInfoBuffers.length))) {
                    let getMaterial = (texCoords, materialID) => {
                        let materialInfo = this.sceneData.materialInfoBuffer[materialID]
                        let material = {
                            baseColor: materialInfo.baseColor.value,
                            metallic: materialInfo.metallicRoughness.value[0],
                            roughness: materialInfo.metallicRoughness.value[1],
                            emissive: materialInfo.emissive.value,
                            normalMap: materialInfo.normalMap.value,
                        }
                        if (ti.static(this.batchInfos[batchID].materialIndex != -1)) {
                            let materialRef = this.scene.materials[this.batchInfos[batchID].materialIndex]
                            if (ti.static(materialRef.baseColor.texture !== undefined)) {
                                let sampledBaseColor = ti.textureSample(materialRef.baseColor.texture, texCoords)
                                sampledBaseColor.rgb = sRGBToLinear(sampledBaseColor.rgb)
                                material.baseColor *= sampledBaseColor
                            }
                            if (ti.static(materialRef.metallicRoughness.texture !== undefined)) {
                                let metallicRoughness = ti.textureSample(materialRef.metallicRoughness.texture, texCoords)
                                material.metallic *= metallicRoughness.b
                                material.roughness *= metallicRoughness.g
                            }
                            if (ti.static(materialRef.emissive.texture !== undefined)) {
                                let sampledEmissive = ti.textureSample(materialRef.emissive.texture, texCoords).rgb
                                sampledEmissive = sRGBToLinear(sampledEmissive)
                                material.emissive *= sampledEmissive
                            }
                            if (ti.static(materialRef.normalMap.texture !== undefined)) {
                                let sampledNormal = ti.textureSample(materialRef.normalMap.texture, texCoords).rgb
                                material.normalMap = sampledNormal
                            }
                        }
                        return material
                    }
                    for (let v of ti.inputVertices(this.sceneData.vertexBuffer, this.sceneData.indexBuffer, this.batchesDrawInfoBuffers[batchID], this.batchesDrawInfoBuffers[batchID].dimensions[0])) {
                        let instanceIndex = ti.getInstanceIndex()
                        let instanceInfo = this.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                        let nodeIndex = instanceInfo.nodeIndex
                        let materialIndex = instanceInfo.materialIndex
                        let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix

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
                        let viewDir = (camera.position - f.position).normalized()

                        let color = [0.0, 0.0, 0.0]

                        color += material.emissive

                        if (ti.static(this.scene.lights.length > 0)) {
                            for (let i of range(this.scene.lights.length)) {
                                let light = this.sceneData.lightsInfoBuffer[i]
                                let fragToLight = light.position - f.position
                                let brightness = getLightBrightness(light, fragToLight)
                                let lightDir = fragToLight.normalized()
                                let halfDir = (lightDir + viewDir).normalized()
                                let brdf = evalBRDF(material, normal, lightDir, viewDir, halfDir)
                                color = color + brightness * brdf
                            }
                        }

                        color += evalIBL(material, normal, viewDir)

                        color = linearTosRGB(color)
                        ti.outputColor(this.canvasTexture, color.concat([1.0]));
                    }
                }
                if(ti.static(this.scene.ibl !== undefined)){
                    for (let v of ti.inputVertices(this.skyboxVBO, this.skyboxIBO)) {
                        let pos = vp.matmul((v + camera.position).concat([1.0]));
                        ti.outputPosition(pos);
                        ti.outputVertex(v);
                    }
                    for (let f of ti.inputFragments()) {
                        let dir = f.normalized()
                        let uv = this.dirToUV(dir)
                        let color = ti.textureSample(this.iblGGXFiltered, uv.concat([0.2]))
                        color.rgb = linearTosRGB(this.tonemap(color.rgb, this.scene.ibl.exposure))
                        color[3] = 1.0
                        ti.outputDepth(1 - 1e-6)
                        ti.outputColor(this.canvasTexture, color);
                    }
                }
            }        )
    }

    async computeDrawBatches() {
        this.batchesDrawInfos = []
        this.batchesDrawInstanceInfos = []

        let textureFreeBatchDrawInfo: DrawInfo[] = []
        let textureFreeBatchInstanceInfo: InstanceInfo[] = []

        for (let i = 0; i < this.scene.materials.length; ++i) {
            let material = this.scene.materials[i]
            let thisMaterialDrawInfo: DrawInfo[] = []
            let thisMaterialInstanceInfo: InstanceInfo[] = []
            for (let nodeIndex = 0; nodeIndex < this.scene.nodes.length; ++nodeIndex) {
                let node = this.scene.nodes[nodeIndex]
                if (node.mesh >= 0) {
                    let mesh = this.scene.meshes[node.mesh]
                    for (let prim of mesh.primitives) {
                        if (prim.materialID === i) {
                            let drawInfo = new DrawInfo(
                                prim.indexCount,
                                1,
                                prim.firstIndex,
                                0,
                                -1 // firstInstance, we'll fill this later
                            )
                            thisMaterialDrawInfo.push(drawInfo)
                            let instanceInfo = new InstanceInfo(nodeIndex, i)
                            thisMaterialInstanceInfo.push(instanceInfo)
                        }
                    }
                }
            }
            if (material.hasTexture()) {
                this.batchesDrawInfos.push(thisMaterialDrawInfo)
                this.batchesDrawInstanceInfos.push(thisMaterialInstanceInfo)
                this.batchInfos.push(new BatchInfo(i))
            }
            else {
                textureFreeBatchDrawInfo = textureFreeBatchDrawInfo.concat(thisMaterialDrawInfo)
                textureFreeBatchInstanceInfo = textureFreeBatchInstanceInfo.concat(thisMaterialInstanceInfo)
            }
        }
        if (textureFreeBatchDrawInfo.length > 0 && textureFreeBatchInstanceInfo.length > 0) {
            this.batchesDrawInfos.push(textureFreeBatchDrawInfo)
            this.batchesDrawInstanceInfos.push(textureFreeBatchInstanceInfo)
            this.batchInfos.push(new BatchInfo(-1)) // -1 stands for "this batch contains more than one (texture-free) materials"
        }
        for (let batch of this.batchesDrawInfos) {
            for (let i = 0; i < batch.length; ++i) {
                batch[i].firstInstance = i
            }
        }

        this.batchesDrawInfoBuffers = []
        for (let drawInfos of this.batchesDrawInfos) {
            let buffer = ti.field(DrawInfo.getKernelType(), drawInfos.length)
            await buffer.fromArray(drawInfos)
            this.batchesDrawInfoBuffers.push(buffer)
        }

        this.batchesDrawInstanceInfoBuffers = []
        for (let drawInstanceInfos of this.batchesDrawInstanceInfos) {
            let buffer = ti.field(InstanceInfo.getKernelType(), drawInstanceInfos.length)
            await buffer.fromArray(drawInstanceInfos)
            this.batchesDrawInstanceInfoBuffers.push(buffer)
        }
    }

    async render(camera: Camera) {
        await this.renderKernel(camera)
    }
}