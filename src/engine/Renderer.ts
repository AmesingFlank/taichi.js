import { Field } from "../data/Field";
import { CanvasTexture, DepthTexture, Texture, TextureBase } from "../data/Texture";
import * as ti from "../taichi"
import { assert } from "../utils/Logging";
import { BatchInfo } from "./common/BatchInfo";
import { Camera } from "./Camera";
import { DrawInfo } from "./common/DrawInfo";
import { InstanceInfo } from "./common/InstanceInfo";
import { LightType } from "./common/LightInfo";
import { Scene, SceneData } from "./Scene";
import { ShadowInfo } from "./common/ShadowInfo";

export class Renderer {
    public constructor(public scene: Scene, public htmlCanvas: HTMLCanvasElement) {
        this.depthTexture = ti.depthTexture([htmlCanvas.width, htmlCanvas.height], 4);
        this.gNormalTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.gPositionTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.directLightingTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.environmentLightingTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.renderResultTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.ssdoTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height], 4);
        this.canvasTexture = ti.canvasTexture(htmlCanvas, 4)

        this.quadVBO = ti.field(ti.types.vector(ti.f32, 2), 4);
        this.quadIBO = ti.field(ti.i32, 6);

        this.ssdoSamples = ti.field(ti.types.vector(ti.f32, 3), [64, 4, 4])
    }



    private depthTexture: DepthTexture
    private gNormalTexture: Texture
    private gPositionTexture: Texture
    private directLightingTexture: Texture
    private environmentLightingTexture: Texture
    private ssdoTexture: Texture
    private renderResultTexture: Texture
    private canvasTexture: CanvasTexture

    private sceneData?: SceneData

    private skyboxVBO?: Field
    private skyboxIBO?: Field

    private quadVBO: Field
    private quadIBO: Field

    private iblLambertianFiltered?: Texture
    private iblGGXFiltered?: Texture
    private LUT?: Texture

    private ssdoSamples: Field

    // batches based on materials
    private batchInfos: BatchInfo[] = []
    private batchesDrawInfos: DrawInfo[][] = []
    private batchesDrawInstanceInfos: InstanceInfo[][] = []

    private batchesDrawInfoBuffers: Field[] = []
    private batchesDrawInstanceInfoBuffers: Field[] = []

    // shadow stuff
    private lightShadowMaps: (DepthTexture | undefined)[] = []
    private iblShadowMaps: DepthTexture[] = []

    private geometryOnlyDrawInfos: DrawInfo[] = []
    private geometryOnlyDrawInstanceInfos: InstanceInfo[] = []

    private geometryOnlyDrawInfoBuffer?: Field
    private geometryOnlyDrawInstanceInfoBuffer?: Field

    private engine = ti.engine


    // ti.funcs
    private uvToDir: ti.FuncType = () => { }
    private dirToUV: ti.FuncType = () => { }
    private tonemap: ti.FuncType = () => { }
    private characteristic: ti.FuncType = () => { }
    private ggxDistribution: ti.FuncType = () => { }
    private getNormal: ti.FuncType = () => { }
    private getLightBrightnessAndDir: ti.FuncType = () => { }
    private lerp: ti.FuncType = () => { }
    private linearTosRGB: ti.FuncType = () => { }
    private sRGBToLinear: ti.FuncType = () => { }
    private fresnel: ti.FuncType = () => { }
    private evalSpecularBRDF: ti.FuncType = () => { }
    private evalDiffuseBRDF: ti.FuncType = () => { }
    private evalMetalBRDF: ti.FuncType = () => { }
    private evalDielectricBRDF: ti.FuncType = () => { }
    private evalBRDF: ti.FuncType = () => { }
    private evalShadow: ti.FuncType = () => { }
    private evalIBL: ti.FuncType = () => { }
    private hammersley2d: ti.FuncType = () => { }
    private generateTBN: ti.FuncType = () => { }
    private cosineSampleHemisphere: ti.FuncType = () => { }
    private cosineSampleHemispherePdf: ti.FuncType = () => { }


    // ti.classKernels
    private zPrePassKernel: ti.KernelType = () => { }
    private gPrePassKernel: ti.KernelType = () => { }
    private shadowKernel: ti.KernelType = () => { }
    private renderKernel: ti.KernelType = () => { }
    private ssdoKernel: ti.KernelType = () => { }
    private combineKernel: ti.KernelType = () => { }
    private presentKernel: ti.KernelType = () => { }


    async init() {
        this.sceneData = await this.scene.getKernelData()
        for (let light of this.scene.lights) {
            if (light.castsShadow) {
                assert(light.type === LightType.Directional, "only directional lights can be shadow casters")
                assert(light.shadow !== undefined, "expexcting shadow info")
                this.lightShadowMaps.push(ti.depthTexture(light.shadow!.shadowMapResolution, 1))
                light.shadow!.view = ti.lookAt(light.position, ti.add(light.position, light.direction), [0.0, 1.0, 0.0]);
                let size = light.shadow!.physicalSize
                light.shadow!.projection = ti.ortho(-0.5 * size[0], 0.5 * size[0], -0.5 * size[1], 0.5 * size[0], 0.0, light.shadow!.maxDistance)
                light.shadow!.viewProjection = ti.matmul(light.shadow!.projection, light.shadow!.view)
            }
        }
        for (let iblShadow of this.scene.iblShadows) {
            this.iblShadowMaps.push(ti.depthTexture(iblShadow.shadowMapResolution, 1))
        }

        await this.quadVBO.fromArray([[-1, -1], [1, -1], [-1, 1], [1, 1]])
        await this.quadIBO.fromArray([0, 1, 2, 1, 3, 2])

        await this.computeDrawBatches()

        await this.initHelperFuncs()
        await this.initIBL()
        await this.initSSDO()
        await this.initKernels()
    }



    async initHelperFuncs() {
        this.uvToDir = ti.func(
            (uv: ti.types.vector): ti.types.vector => {
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

        this.dirToUV = ti.func(
            (dir: ti.types.vector): ti.types.vector => {
                return [0.5 + 0.5 * Math.atan2(dir[2], dir[0]) / Math.PI, 1.0 - Math.acos(dir[1]) / Math.PI]
            }
        )

        this.tonemap = ti.func(
            (color: ti.types.vector, exposure: number) => {
                let A = 2.51;
                let B = 0.03;
                let C = 2.43;
                let D = 0.59;
                let E = 0.14;
                //@ts-ignore
                let temp = color * exposure
                temp = (temp * (A * temp + B)) / (temp * (C * temp + D) + E)
                return Math.max(0.0, Math.min(1.0, temp))
            }
        )

        this.characteristic = ti.func(
            (x: number) => {
                let result = 1
                if (x < 0) {
                    result = 0
                }
                return result
            }
        )

        this.ggxDistribution = ti.func(
            (NdotH: number, alpha: number) => {
                let numerator = alpha * alpha * this.characteristic(NdotH)
                let temp = NdotH * NdotH * (alpha * alpha - 1) + 1
                let denominator = Math.PI * temp * temp
                return numerator / denominator
            }
        )

        this.getLightBrightnessAndDir = ti.func((light: any, fragPos: ti.types.vector) => {
            let brightness: ti.types.vector = [0.0, 0.0, 0.0]
            let lightDir: ti.types.vector = [0.0, 0.0, 0.0]
            if (light.type === this.engine.LightType.Point || light.type === this.engine.LightType.Spot) {
                let fragToLight = light.position - fragPos
                let distance = ti.norm(fragToLight)
                let attenuation = 1.0 / (Math.max(distance * distance, 0.01 * 0.01))
                let window = (1 - (distance / light.influenceRadius) ** 2) ** 4
                //@ts-ignore
                brightness = light.brightness * attenuation * window
                if (light.type === this.engine.LightType.Spot) {
                    let cosAngle = ti.dot(-ti.normalized(fragToLight), light.direction)
                    let spotScale = 1.0 / Math.max(Math.cos(light.innerConeAngle) - Math.cos(light.outerConeAngle), 1e-4)
                    let spotOffset = -Math.cos(light.outerConeAngle) * spotScale
                    let t = cosAngle * spotScale + spotOffset
                    t = Math.max(0.0, Math.min(1.0, t))
                    //@ts-ignore
                    brightness = brightness * t * t
                }
                lightDir = ti.normalized(fragToLight)
            }
            else if (light.type === this.engine.LightType.Directional) {
                brightness = light.brightness
                lightDir = -light.direction
            }
            return {
                brightness,
                lightDir
            }
        })

        this.lerp = ti.func((x: ti.types.vector | number, y: ti.types.vector | number, s: number): ti.types.vector | number => {
            return x * (1.0 - s) + y * s
        })

        this.linearTosRGB = ti.func((x: ti.types.vector | number): ti.types.vector | number => {
            return Math.pow(x, 1.0 / 2.2)
        })

        this.sRGBToLinear = ti.func((x: ti.types.vector | number): ti.types.vector | number => {
            return Math.pow(x, 2.2)
        })

        this.fresnel = ti.func((F0: ti.types.vector | number, directions: any) => {
            return F0 + (1.0 - F0) * (1.0 - Math.abs(directions.HdotV)) ** 5
        })

        this.evalSpecularBRDF = ti.func((alpha: number, Fr: ti.types.vector | number, directions: any) => {
            let D = this.ggxDistribution(directions.NdotH, alpha)
            let NdotL = Math.abs(directions.NdotL)
            let NdotV = Math.abs(directions.NdotV)
            let G2_Over_4_NdotL_NdotV = 0.5 / this.lerp(2 * NdotL * NdotV, NdotL + NdotV, alpha)
            return G2_Over_4_NdotL_NdotV * D * Fr * this.characteristic(directions.HdotL) * this.characteristic(directions.HdotV)
        })

        this.evalDiffuseBRDF = ti.func((albedo: any, directions: any) => {
            return albedo * (1.0 / Math.PI) * this.characteristic(directions.NdotL) * this.characteristic(directions.NdotV)
        })

        this.evalMetalBRDF = ti.func((alpha: number, baseColor: ti.types.vector, directions: any) => {
            let F0 = baseColor
            let Fr = this.fresnel(F0, directions)
            return this.evalSpecularBRDF(alpha, Fr, directions)
        })


        this.evalDielectricBRDF = ti.func((alpha: number, baseColor: ti.types.vector, directions: any) => {
            let dielectricF0: ti.types.vector = [0.04, 0.04, 0.04]
            let Fr = this.fresnel(dielectricF0, directions)
            let specular = this.evalSpecularBRDF(alpha, Fr, directions)
            let diffuse = this.evalDiffuseBRDF(baseColor, directions)
            return diffuse * (1 - Fr) + specular
        })

        this.evalBRDF = ti.func((material: any, normal: ti.types.vector, lightDir: ti.types.vector, viewDir: ti.types.vector) => {
            let halfDir = ti.normalized(viewDir + lightDir)
            let directions = {
                normal: normal,
                lightDir: lightDir,
                viewDir: viewDir,
                halfDir: halfDir,
                NdotH: ti.dot(normal, halfDir),
                NdotV: ti.dot(normal, viewDir),
                NdotL: ti.dot(normal, lightDir),
                HdotV: ti.dot(halfDir, viewDir),
                HdotL: ti.dot(halfDir, lightDir),
            }
            let alpha = material.roughness * material.roughness
            let metallicBRDF = this.evalMetalBRDF(alpha, material.baseColor.rgb, directions)
            let dielectricBRDF = this.evalDielectricBRDF(alpha, material.baseColor.rgb, directions)
            return material.metallic * metallicBRDF + (1.0 - material.metallic) * dielectricBRDF
        })

        this.evalShadow = ti.func((pos: ti.types.vector, shadowMap: DepthTexture, shadowInfo: ShadowInfo) => {
            let vp = shadowInfo.viewProjection
            let clipSpacePos = ti.matmul(vp, pos.concat([1.0]))
            let depth = clipSpacePos.z / clipSpacePos.w
            let coords: ti.types.vector = (clipSpacePos.xy / clipSpacePos.w) * 0.5 + 0.5
            coords.y = 1.0 - coords.y
            let visibility = ti.textureSampleCompare(shadowMap, coords, depth - 0.01)
            let contribution = (1.0 - (1.0 - visibility) * shadowInfo.strength)
            return contribution
        })

        this.evalIBL = ti.func((material: any, normal: ti.types.vector, viewDir: ti.types.vector, pos: ti.types.vector) => {
            let dielectricF0: ti.types.vector = [0.04, 0.04, 0.04]
            let result: ti.types.vector = [0.0, 0.0, 0.0]
            if (ti.Static(this.scene.ibl !== undefined)) {
                let diffuseColor = (1.0 - material.metallic) * (1.0 - dielectricF0) * material.baseColor.rgb
                let normalUV = this.dirToUV(normal)
                let diffuseLight = this.sRGBToLinear(this.tonemap(ti.textureSample(this.iblLambertianFiltered!, normalUV).rgb, this.scene.ibl!.exposure))
                let diffuse = diffuseColor * diffuseLight

                let specularColor = (1.0 - material.metallic) * dielectricF0 + material.metallic * material.baseColor.rgb
                let reflection = ti.normalized((2.0 * normal * ti.dot(normal, viewDir) - viewDir))
                let reflectionUV = this.dirToUV(reflection)
                let specularLight = this.sRGBToLinear(this.tonemap(ti.textureSample(this.iblGGXFiltered!, reflectionUV.concat([material.roughness])).rgb, this.scene.ibl!.exposure))
                let NdotV = ti.dot(normal, viewDir)
                let scaleBias = ti.textureSample(this.LUT!, [NdotV, material.roughness]).rg
                let specular = specularLight * (specularColor * scaleBias[0] + scaleBias[1])

                result = specular + diffuse
                for (let i of ti.Static(ti.range(this.scene.iblShadows.length))) {
                    let contribution = this.evalShadow(pos, this.iblShadowMaps[i], this.scene.iblShadows[i])
                    result *= contribution
                }
            }
            return result
        })

        this.getNormal = ti.func(
            (normal: ti.types.vector, normalMap: ti.types.vector, texCoords: ti.types.vector, position: ti.types.vector) => {
                let uvDx: ti.types.vector = ti.dpdx(texCoords.concat([0.0]))
                let uvDy: ti.types.vector = ti.dpdy(texCoords.concat([0.0]))
                let posDx: ti.types.vector = ti.dpdx(position)
                let posDy: ti.types.vector = ti.dpdy(position)
                let denom = (uvDx[0] * uvDy[1] - uvDy[0] * uvDx[1])
                let temp = (uvDy[1] * posDx - uvDx[1] * posDy) / denom
                let tangent = temp - normal * ti.dot(normal, temp)
                let tangentNorm = ti.norm(tangent)
                let bitangent = ti.cross(normal, tangent)
                let bitangentNorm = ti.norm(bitangent)
                let mat = ti.transpose([tangent / tangentNorm, bitangent / bitangentNorm, normal])
                let normalMapValue = ti.normalized(normalMap * 2.0 - 1.0)
                let result = ti.normalized(ti.matmul(mat, normalMapValue))
                if (denom === 0.0 || tangentNorm === 0.0 || bitangentNorm === 0.0) {
                    result = normal
                }
                return result
            }
        )

        this.hammersley2d = ti.func((i: number, N: number) => {
            let radicalInverseVdC = (bits: number) => {
                bits = (bits << 16) | (bits >>> 16);
                bits = ((bits & 0x55555555) << 1) | ((bits & 0xAAAAAAAA) >>> 1);
                bits = ((bits & 0x33333333) << 2) | ((bits & 0xCCCCCCCC) >>> 2);
                bits = ((bits & 0x0F0F0F0F) << 4) | ((bits & 0xF0F0F0F0) >>> 4);
                bits = ((bits & 0x00FF00FF) << 8) | ((bits & 0xFF00FF00) >>> 8);
                //@ts-ignore
                let result = f32(bits) * 2.3283064365386963e-10;
                if (bits < 0) {
                    //@ts-ignore
                    result = 1.0 + f32(bits) * 2.3283064365386963e-10;
                }
                return result
            }
            //@ts-ignore
            return [f32(i) / N, radicalInverseVdC(i32(i))];
        })

        this.generateTBN = ti.func((normal: ti.types.vector) => {
            let bitangent = [0.0, 1.0, 0.0];

            let NdotUp = ti.dot(normal, [0.0, 1.0, 0.0]);
            let epsilon = 0.0000001;
            if (1.0 - Math.abs(NdotUp) <= epsilon) {
                // Sampling +Y or -Y, so we need a more robust bitangent.
                if (NdotUp > 0.0) {
                    bitangent = [0.0, 0.0, 1.0];
                }
                else {
                    bitangent = [0.0, 0.0, -1.0];
                }
            }

            let tangent = ti.normalized(ti.cross(bitangent, normal));
            bitangent = ti.cross(normal, tangent);

            return ti.transpose([tangent, bitangent, normal]);
        })

        this.cosineSampleHemisphere = ti.func((randomSource: ti.types.vector) => {
            let concentricSampleDisk = (randomSource: ti.types.vector) => {
                let result: ti.types.vector = [0.0, 0.0]
                let uOffset: ti.types.vector = 2.0 * randomSource - 1.0;
                if (uOffset.x !== 0 || uOffset.y !== 0) {
                    let theta = 0.0
                    let r = 0.0
                    if (Math.abs(uOffset.x) > Math.abs(uOffset.y)) {
                        r = uOffset.x
                        theta = (Math.PI / 4.0) * (uOffset.y / uOffset.x)
                    }
                    else {
                        r = uOffset.y
                        theta = (Math.PI / 2.0) - (Math.PI / 4.0) * (uOffset.x / uOffset.y);
                    }
                    //@ts-ignore
                    result = r * [Math.cos(theta), Math.sin(theta)];
                }
                return result
            }
            let d = concentricSampleDisk(randomSource);
            let z = Math.sqrt(Math.max(0.0, 1 - d.x * d.x - d.y * d.y));
            return [d.x, d.y, z]
        })

        this.cosineSampleHemispherePdf = ti.func((sampled: ti.types.vector) => {
            let cosTheta = sampled.z
            return cosTheta / Math.PI
        })

    }

    async initKernels() {
        this.zPrePassKernel = ti.classKernel(this,
            { camera: Camera.getKernelType() },
            (camera: any) => {
                ti.useDepth(this.depthTexture);
                for (let v of ti.inputVertices(this.sceneData!.vertexBuffer, this.sceneData!.indexBuffer, ti.Static(this.geometryOnlyDrawInfoBuffer), ti.Static(this.geometryOnlyDrawInfoBuffer!.dimensions[0]))) {
                    let instanceIndex = ti.getInstanceIndex()
                    //@ts-ignore
                    let instanceInfo = this.geometryOnlyDrawInstanceInfoBuffer[instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    //@ts-ignore
                    let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix

                    v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                    let pos = ti.matmul(camera.viewProjection, v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    //no-op
                }
            }
        )
        this.gPrePassKernel = ti.classKernel(this,
            { camera: Camera.getKernelType() },
            (camera: any) => {
                ti.useDepth(this.depthTexture);
                ti.clearColor(this.gNormalTexture, [0.0, 0.0, 0.0, 0.0])
                ti.clearColor(this.gPositionTexture, [0.0, 0.0, 0.0, 0.0])
                for (let v of ti.inputVertices(this.sceneData!.vertexBuffer, this.sceneData!.indexBuffer, ti.Static(this.geometryOnlyDrawInfoBuffer), ti.Static(this.geometryOnlyDrawInfoBuffer!.dimensions[0]))) {
                    let instanceIndex = ti.getInstanceIndex()
                    //@ts-ignore
                    let instanceInfo = this.geometryOnlyDrawInstanceInfoBuffer[instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    //@ts-ignore
                    let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix
                    v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                    v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                    let pos = ti.matmul(camera.viewProjection, v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    //no-op
                    let normal = ti.normalized(f.normal)
                    ti.outputColor(this.gNormalTexture, normal.concat([1.0]))
                    ti.outputColor(this.gPositionTexture, f.position.concat([1.0]))
                }
            }
        )
        this.renderKernel = ti.classKernel(this,
            { camera: Camera.getKernelType() },
            (camera: any) => {
                ti.useDepth(this.depthTexture, { storeDepth: false, clearDepth: false });
                ti.clearColor(this.directLightingTexture, [0, 0, 0, 1]);
                ti.clearColor(this.environmentLightingTexture, [0, 0, 0, 1]);

                for (let batchID of ti.Static(ti.range(this.batchesDrawInfoBuffers.length))) {
                    let getMaterial = (fragment: any, materialID: number) => {
                        //@ts-ignore
                        let materialInfo = this.sceneData.materialInfoBuffer[materialID]
                        let material = {
                            baseColor: materialInfo.baseColor.value,
                            metallic: materialInfo.metallicRoughness.value[0],
                            roughness: materialInfo.metallicRoughness.value[1],
                            emissive: materialInfo.emissive.value,
                            normalMap: materialInfo.normalMap.value,
                        }
                        if (ti.Static(this.batchInfos[batchID].materialIndex != -1)) {
                            let texCoords = fragment.texCoords0
                            let materialRef = this.scene.materials[this.batchInfos[batchID].materialIndex]
                            if (ti.Static(materialRef.baseColor.texture !== undefined)) {
                                if (ti.Static(materialRef.baseColor.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let sampledBaseColor = ti.textureSample(materialRef.baseColor.texture!, texCoords)
                                sampledBaseColor.rgb = this.sRGBToLinear(sampledBaseColor.rgb)
                                material.baseColor *= sampledBaseColor
                            }
                            if (ti.Static(materialRef.metallicRoughness.texture !== undefined)) {
                                if (ti.Static(materialRef.metallicRoughness.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let metallicRoughness = ti.textureSample(materialRef.metallicRoughness.texture!, texCoords)
                                material.metallic *= metallicRoughness.b
                                material.roughness *= metallicRoughness.g
                            }
                            if (ti.Static(materialRef.emissive.texture !== undefined)) {
                                if (ti.Static(materialRef.emissive.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let sampledEmissive = ti.textureSample(materialRef.emissive.texture!, texCoords).rgb
                                sampledEmissive = this.sRGBToLinear(sampledEmissive)
                                material.emissive *= sampledEmissive
                            }
                            if (ti.Static(materialRef.normalMap.texture !== undefined)) {
                                if (ti.Static(materialRef.normalMap.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let sampledNormal = ti.textureSample(materialRef.normalMap.texture!, texCoords).rgb
                                material.normalMap = sampledNormal
                            }
                        }
                        return material
                    }

                    for (let v of ti.inputVertices(this.sceneData!.vertexBuffer, this.sceneData!.indexBuffer, ti.Static(this.batchesDrawInfoBuffers[batchID]), ti.Static(this.batchesDrawInfoBuffers[batchID].dimensions[0]))) {
                        let instanceIndex = ti.getInstanceIndex()
                        //@ts-ignore
                        let instanceInfo = this.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                        let nodeIndex = instanceInfo.nodeIndex
                        let materialIndex = instanceInfo.materialIndex
                        //@ts-ignore
                        let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix

                        v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                        v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                        let pos = camera.viewProjection.matmul(v.position.concat([1.0]));
                        ti.outputPosition(pos);
                        let vertexOutput = ti.mergeStructs(v, { materialIndex: materialIndex })
                        ti.outputVertex(vertexOutput);
                    }
                    for (let f of ti.inputFragments()) {
                        let materialID = f.materialIndex
                        let material = getMaterial(f, materialID)
                        let normal = f.normal.normalized()
                        normal = this.getNormal(normal, material.normalMap, f.texCoords0, f.position)
                        let viewDir = ti.normalized(camera.position - f.position)

                        let directLighting: ti.types.vector = [0.0, 0.0, 0.0]
                        directLighting += material.emissive

                        let evalLight = (light: any) => {
                            let brightnessAndDir = this.getLightBrightnessAndDir(light, f.position)
                            let brdf = this.evalBRDF(material, normal, brightnessAndDir.lightDir, viewDir)
                            return brightnessAndDir.brightness * brdf
                        }

                        if (ti.Static(this.scene.lights.length > 0)) {
                            for (let i of ti.range(this.scene.lights.length)) {
                                //@ts-ignore
                                let light = this.sceneData.lightsInfoBuffer[i]
                                if (!light.castsShadow) {
                                    directLighting += evalLight(light)
                                }
                            }
                            for (let i of ti.Static(ti.range(this.scene.lights.length))) {
                                if (ti.Static(this.scene.lights[i].castsShadow)) {
                                    directLighting += evalLight(this.scene.lights[i]) * this.evalShadow(f.position, this.lightShadowMaps[i]!, this.scene.lights[i].shadow!)
                                }
                            }
                        }

                        let environmentLighting: ti.types.vector = this.evalIBL(material, normal, viewDir, f.position)

                        ti.outputColor(this.directLightingTexture, directLighting.concat([1.0]));
                        ti.outputColor(this.environmentLightingTexture, environmentLighting.concat([1.0]));
                    }
                }
                if (ti.Static(this.scene.ibl !== undefined)) {
                    for (let v of ti.inputVertices(this.skyboxVBO!, this.skyboxIBO!)) {
                        let pos = camera.viewProjection.matmul((v + camera.position).concat([1.0]));
                        ti.outputPosition(pos);
                        ti.outputVertex(v);
                    }
                    for (let f of ti.inputFragments()) {
                        let dir = f.normalized()
                        let uv = this.dirToUV(dir)
                        let color = ti.textureSample(this.iblGGXFiltered!, uv.concat([0.2]))
                        color.rgb = this.tonemap(color.rgb, this.scene.ibl!.exposure)
                        color[3] = 1.0
                        ti.outputDepth(1 - 1e-6)
                        ti.outputColor(this.directLightingTexture, [0.0, 0.0, 0.0, 0.0]);
                        ti.outputColor(this.environmentLightingTexture, color);
                    }
                }
            }
        )
        this.ssdoKernel = ti.classKernel(this,
            { camera: Camera.getKernelType() },
            (camera: any) => {
                ti.useDepth(this.depthTexture, { storeDepth: false, clearDepth: false });
                ti.clearColor(this.ssdoTexture, [0, 0, 0, 0]);

                for (let batchID of ti.Static(ti.range(this.batchesDrawInfoBuffers.length))) {
                    let getMaterial = (fragment: any, materialID: number) => {
                        //@ts-ignore
                        let materialInfo = this.sceneData.materialInfoBuffer[materialID]
                        let material = {
                            baseColor: materialInfo.baseColor.value,
                            metallic: materialInfo.metallicRoughness.value[0],
                            roughness: materialInfo.metallicRoughness.value[1],
                        }
                        if (ti.Static(this.batchInfos[batchID].materialIndex != -1)) {
                            let texCoords = fragment.texCoords0
                            let materialRef = this.scene.materials[this.batchInfos[batchID].materialIndex]
                            if (ti.Static(materialRef.baseColor.texture !== undefined)) {
                                if (ti.Static(materialRef.baseColor.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let sampledBaseColor = ti.textureSample(materialRef.baseColor.texture!, texCoords)
                                sampledBaseColor.rgb = this.sRGBToLinear(sampledBaseColor.rgb)
                                material.baseColor *= sampledBaseColor
                            }
                            if (ti.Static(materialRef.metallicRoughness.texture !== undefined)) {
                                if (ti.Static(materialRef.metallicRoughness.texcoordsSet === 1)) {
                                    texCoords = fragment.texCoords1
                                }
                                let metallicRoughness = ti.textureSample(materialRef.metallicRoughness.texture!, texCoords)
                                material.metallic *= metallicRoughness.b
                                material.roughness *= metallicRoughness.g
                            }
                        }
                        return material
                    }

                    for (let v of ti.inputVertices(this.sceneData!.vertexBuffer, this.sceneData!.indexBuffer, ti.Static(this.batchesDrawInfoBuffers[batchID]), ti.Static(this.batchesDrawInfoBuffers[batchID].dimensions[0]))) {
                        let instanceIndex = ti.getInstanceIndex()
                        //@ts-ignore
                        let instanceInfo = this.batchesDrawInstanceInfoBuffers[batchID][instanceIndex]
                        let nodeIndex = instanceInfo.nodeIndex
                        let materialIndex = instanceInfo.materialIndex
                        //@ts-ignore
                        let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix

                        v.normal = ti.transpose(ti.inverse(modelMatrix.slice([0, 0], [3, 3]))).matmul(v.normal)
                        v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                        let pos = camera.viewProjection.matmul(v.position.concat([1.0]));
                        ti.outputPosition(pos);
                        let vertexOutput = ti.mergeStructs(v, { materialIndex: materialIndex })
                        ti.outputVertex(vertexOutput);
                    }
                    for (let f of ti.inputFragments()) {
                        let materialID = f.materialIndex
                        let material = getMaterial(f, materialID)
                        let normal = f.normal.normalized()
                        let TBN = this.generateTBN(normal)


                        let clipSpacePos = ti.matmul(camera.viewProjection, f.position.concat([1.0]))
                        let screenSpaceCoords: ti.types.vector = (clipSpacePos.xy / clipSpacePos.w) * 0.5 + 0.5
                        //@ts-ignore
                        let texelIndex = ti.i32([screenSpaceCoords.x, 1.0 - screenSpaceCoords.y] * ([this.htmlCanvas.width, this.htmlCanvas.height] - 1))
                        let indexInBlock: ti.types.vector = [texelIndex.x % this.ssdoSamples.dimensions[1], texelIndex.y % this.ssdoSamples.dimensions[2]]
                        //@ts-ignore
                        let numSamples = this.ssdoSamples.dimensions[0]
                        let viewDir = ti.normalized(f.position - camera.position)
                        let sampleRadius = ti.norm(f.position - camera.position) * 0.05

                        let sumVisibility = 0.0
                        let sumIndirectLighting: ti.types.vector = [0.0, 0.0, 0.0]

                        for (let i of ti.range(numSamples)) {
                            //@ts-ignore
                            let ssdoSample = this.ssdoSamples[[i, indexInBlock.x, indexInBlock.y]]
                            let deltaPos = ti.matmul(TBN, ssdoSample) * sampleRadius
                            let sampledPoint = deltaPos + f.position
                            let sampledPointClipSpace = ti.matmul(camera.viewProjection, sampledPoint.concat([1.0]))
                            let depth = sampledPointClipSpace.z / sampledPointClipSpace.w
                            let sampledPointScreenSpace: ti.types.vector = (sampledPointClipSpace.xy / sampledPointClipSpace.w) * 0.5 + 0.5
                            let texCoords = [sampledPointScreenSpace.x, 1.0 - sampledPointScreenSpace.y]
                            //@ts-ignore
                            let gBufferPos = ti.textureSample(this.gPositionTexture, texCoords).rgb
                            let gBufferNormal = ti.textureSample(this.gNormalTexture, texCoords).rgb

                            let vis = 1.0;
                            if (ti.norm(gBufferPos - camera.position) < ti.norm(sampledPoint - camera.position)) {
                                vis = 0.0
                            }
                            sumVisibility += vis // should multiply by cosTheta here (see games 202 lecture), but this is cancelled by dividing the PDF

                            let receivedIndirectLight =
                                ti.textureSample(this.directLightingTexture, texCoords).rgb +
                                ti.textureSample(this.environmentLightingTexture, texCoords).rgb
                            if (ti.dot(gBufferNormal, deltaPos) >= 0.0) {
                                // sampled point faces away from the fragment
                                receivedIndirectLight = [0.0, 0.0, 0.0]
                            }
                            let brdf = this.evalBRDF(material, normal, ti.normalized(deltaPos), viewDir)
                            sumIndirectLighting += receivedIndirectLight * brdf * (1.0 - vis)
                        }
                        let result = sumIndirectLighting.concat([sumVisibility]) / numSamples
                        ti.outputColor(this.ssdoTexture, result)
                    }
                }
            }
        )
        this.shadowKernel = ti.classKernel(this,
            { shadowMap: ti.template(), shadowInfo: ti.template() },
            (shadowMap: DepthTexture, shadowInfo: ShadowInfo) => {
                ti.useDepth(shadowMap);
                for (let v of ti.inputVertices(this.sceneData!.vertexBuffer, this.sceneData!.indexBuffer, ti.Static(this.geometryOnlyDrawInfoBuffer), ti.Static(this.geometryOnlyDrawInfoBuffer!.dimensions[0]))) {
                    let instanceIndex = ti.getInstanceIndex()
                    //@ts-ignore
                    let instanceInfo = this.geometryOnlyDrawInstanceInfoBuffer[instanceIndex]
                    let nodeIndex = instanceInfo.nodeIndex
                    //@ts-ignore
                    let modelMatrix = this.sceneData.nodesBuffer[nodeIndex].globalTransform.matrix

                    v.position = modelMatrix.matmul(v.position.concat([1.0])).xyz
                    let pos = ti.matmul(shadowInfo.viewProjection, v.position.concat([1.0]));
                    ti.outputPosition(pos);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    //no-op
                }
            }
        )
        this.combineKernel = ti.classKernel(this,
            {},
            () => {
                ti.clearColor(this.renderResultTexture, [0.0, 0.0, 0.0, 1]);
                for (let v of ti.inputVertices(this.quadVBO, this.quadIBO)) {
                    ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    let coord: ti.types.vector = (f + 1) / 2.0
                    coord[1] = 1 - coord[1]

                    let directLighting = ti.textureSample(this.directLightingTexture, coord).rgb
                    let environmentLighting = ti.textureSample(this.environmentLightingTexture, coord).rgb
                    let ssdo = ti.textureSample(this.ssdoTexture, coord)
                    let color = directLighting + environmentLighting + ssdo.rgb
                    color = this.linearTosRGB(color)
                    ti.outputColor(this.renderResultTexture, color.concat([1.0]))
                }
            }
        )
        this.presentKernel = ti.classKernel(this,
            { presentedTexture: ti.template() },
            (presentedTexture: Texture) => {
                ti.clearColor(this.canvasTexture, [0.0, 0.0, 0.0, 1]);
                for (let v of ti.inputVertices(this.quadVBO, this.quadIBO)) {
                    ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    let coord: ti.types.vector = (f + 1) / 2.0
                    coord[1] = 1 - coord[1]

                    let color = ti.textureSample(presentedTexture, coord)
                    color[3] = 1.0
                    ti.outputColor(this.canvasTexture, color)
                }
            }
        )
    }

    async initSSDO() {
        let generateSamples = ti.classKernel(this,
            () => {
                let numSamples = this.ssdoSamples.dimensions[0]
                let blockSizeX = this.ssdoSamples.dimensions[1]
                let blockSizeY = this.ssdoSamples.dimensions[2]
                for (let I of ti.ndrange(numSamples, blockSizeX, blockSizeY)) {
                    let sampleId = I[0]
                    let randomSource = this.hammersley2d(sampleId, numSamples)
                    let sample = this.cosineSampleHemisphere(randomSource)
                    let length = Math.random()
                    length = this.lerp(0.1, 1.0, length * length)
                    sample *= length
                    //@ts-ignore
                    this.ssdoSamples[I] = sample
                }
            }
        )
        await generateSamples()
    }

    async initIBL() {
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

                    let computeLod = (pdf: number) => {
                        return 0.5 * Math.log(6.0 * this.scene.ibl!.texture.dimensions[0] * this.scene.ibl!.texture.dimensions[0] / (kSampleCount * pdf)) / Math.log(2.0);
                    }

                    let getLambertianImportanceSample = (normal: ti.types.vector, xi: ti.types.vector) => {
                        let localSpaceDirection = this.cosineSampleHemisphere(xi)
                        let pdf = this.cosineSampleHemispherePdf(localSpaceDirection)
                        let TBN = this.generateTBN(normal);
                        let direction = ti.matmul(TBN, localSpaceDirection);
                        return {
                            pdf: pdf,
                            direction: direction
                        }
                    }

                    let filterLambertian = (normal: ti.types.vector) => {
                        let color: any = [0.0, 0.0, 0.0]
                        for (let i of ti.range(kSampleCount)) {
                            let xi = this.hammersley2d(i, kSampleCount)
                            let importanceSample = getLambertianImportanceSample(normal, xi)
                            let halfDir = importanceSample.direction
                            let pdf = importanceSample.pdf
                            let lod = computeLod(pdf);
                            let halfDirCoords = this.dirToUV(halfDir)
                            let sampled = ti.textureSampleLod(this.scene.ibl!.texture, halfDirCoords, lod)
                            //@ts-ignore
                            color += sampled.rgb / kSampleCount
                        }
                        return color
                    }

                    for (let I of ti.ndrange(this.iblLambertianFiltered!.dimensions[0], this.iblLambertianFiltered!.dimensions[1])) {
                        //@ts-ignore
                        let uv = I / (this.iblLambertianFiltered.dimensions - [1.0, 1.0])
                        let dir = this.uvToDir(uv)
                        let filtered = filterLambertian(dir)
                        ti.textureStore(this.iblLambertianFiltered!, I, filtered.concat([1.0]));
                    }

                    let saturate = (v: any) => {
                        return Math.max(0.0, Math.min(1.0, v))
                    }

                    let getGGXImportanceSample = (normal: ti.types.vector, roughness: number, xi: ti.types.vector) => {
                        let alpha = roughness * roughness;
                        let cosTheta = saturate(Math.sqrt((1.0 - xi[1]) / (1.0 + (alpha * alpha - 1.0) * xi[1])));
                        let sinTheta = Math.sqrt(1.0 - cosTheta * cosTheta);
                        let phi = 2.0 * Math.PI * xi[0];

                        let pdf = this.ggxDistribution(cosTheta, alpha) / 4.0;
                        let localSpaceDirection = [
                            sinTheta * Math.cos(phi),
                            sinTheta * Math.sin(phi),
                            cosTheta
                        ]
                        let TBN = this.generateTBN(normal);
                        let direction = ti.matmul(TBN, localSpaceDirection);
                        return {
                            pdf: pdf,
                            direction: direction
                        }
                    }

                    let filterGGX = (normal: ti.types.vector, roughness: number) => {
                        let color = [0.0, 0.0, 0.0]
                        for (let i of ti.range(kSampleCount)) {
                            let xi = this.hammersley2d(i, kSampleCount)
                            let importanceSample = getGGXImportanceSample(normal, roughness, xi)
                            let halfDir = importanceSample.direction
                            let pdf = importanceSample.pdf
                            let lod = computeLod(pdf);
                            if (roughness == 0.0) {
                                lod = 0.0
                            }
                            let halfDirCoords = this.dirToUV(halfDir)
                            let sampled = ti.textureSampleLod(this.scene.ibl!.texture, halfDirCoords, lod)
                            //@ts-ignore
                            color += sampled.rgb / kSampleCount
                        }
                        return color
                    }

                    for (let I of ti.ndrange(this.iblGGXFiltered!.dimensions[0], this.iblGGXFiltered!.dimensions[1])) {
                        let numLevels = this.iblGGXFiltered!.dimensions[2]
                        for (let level of ti.range(numLevels)) {
                            let roughness = level / (numLevels - 1)
                            //@ts-ignore
                            let uv = I / (this.iblGGXFiltered.dimensions.slice(0, 2) - [1.0, 1.0])
                            let dir = this.uvToDir(uv)
                            let filtered = filterGGX(dir, roughness)
                            ti.textureStore(this.iblGGXFiltered!, I.concat([level]), filtered.concat([1.0]));
                        }
                    }

                    let computeLUT = (NdotV: number, roughness: number): ti.types.vector => {
                        let V: any = [Math.sqrt(1.0 - NdotV * NdotV), 0.0, NdotV];
                        let N = [0.0, 0.0, 1.0];

                        let A = 0.0;
                        let B = 0.0;
                        let C = 0.0;

                        for (let i of ti.range(kSampleCount)) {
                            let xi = this.hammersley2d(i, kSampleCount)
                            let importanceSample = getGGXImportanceSample(N, roughness, xi)
                            let H: any = importanceSample.direction;
                            // float pdf = importanceSample.w;
                            //@ts-ignore
                            let L = ti.normalized(2.0 * H * ti.dot(H, V) - V)

                            let NdotL = saturate(L[2]);
                            let NdotH = saturate(H[2]);
                            let VdotH = saturate(ti.dot(V, H));

                            if (NdotL > 0.0) {
                                let a2 = Math.pow(roughness, 4.0);
                                let GGXV = NdotL * Math.sqrt(NdotV * NdotV * (1.0 - a2) + a2);
                                let GGXL = NdotV * Math.sqrt(NdotL * NdotL * (1.0 - a2) + a2);
                                let V_pdf = (0.5 / (GGXV + GGXL)) * VdotH * NdotL / NdotH;
                                let Fc = Math.pow(1.0 - VdotH, 5.0);
                                A += (1.0 - Fc) * V_pdf;
                                B += Fc * V_pdf;
                                C += 0.0;
                            }
                        }
                        //@ts-ignore
                        return [4.0 * A, 4.0 * B, 4.0 * 2.0 * Math.PI * C] / kSampleCount;
                    }

                    for (let I of ti.ndrange(this.LUT!.dimensions[0], this.LUT!.dimensions[1])) {
                        //@ts-ignore
                        let uv: ti.types.vector = I / (this.LUT.dimensions - [1.0, 1.0])
                        let texel = computeLUT(uv[0], uv[1])
                        ti.textureStore(this.LUT!, I, texel.concat([1.0]));
                    }
                },
                undefined
            )
            await prefilterKernel()
        }
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

        // shadow pass instance infos
        this.geometryOnlyDrawInfos = []
        this.geometryOnlyDrawInstanceInfos = []

        for (let nodeIndex = 0; nodeIndex < this.scene.nodes.length; ++nodeIndex) {
            let node = this.scene.nodes[nodeIndex]
            if (node.mesh >= 0) {
                let mesh = this.scene.meshes[node.mesh]
                for (let prim of mesh.primitives) {
                    let firstInstance = this.geometryOnlyDrawInstanceInfos.length
                    let drawInfo = new DrawInfo(
                        prim.indexCount,
                        1,
                        prim.firstIndex,
                        0,
                        firstInstance
                    )
                    this.geometryOnlyDrawInfos.push(drawInfo)
                    let instanceInfo = new InstanceInfo(nodeIndex, prim.materialID)
                    this.geometryOnlyDrawInstanceInfos.push(instanceInfo)
                }
            }
        }
        this.geometryOnlyDrawInfoBuffer = ti.field(DrawInfo.getKernelType(), this.geometryOnlyDrawInfos.length)
        await this.geometryOnlyDrawInfoBuffer.fromArray(this.geometryOnlyDrawInfos)
        this.geometryOnlyDrawInstanceInfoBuffer = ti.field(InstanceInfo.getKernelType(), this.geometryOnlyDrawInstanceInfos.length)
        await this.geometryOnlyDrawInstanceInfoBuffer.fromArray(this.geometryOnlyDrawInstanceInfos)
    }

    async render(camera: Camera) {
        let aspectRatio = this.htmlCanvas.width / this.htmlCanvas.height
        camera.computeMatrices(aspectRatio)
        for (let i = 0; i < this.scene.lights.length; ++i) {
            let light = this.scene.lights[i]
            if (light.castsShadow) {
                this.shadowKernel(this.lightShadowMaps[i], light.shadow!)
            }
        }
        for (let i = 0; i < this.scene.iblShadows.length; ++i) {
            this.shadowKernel(this.iblShadowMaps[i], this.scene.iblShadows[i])
        }
        this.gPrePassKernel(camera)
        this.zPrePassKernel(camera)
        this.renderKernel(camera)
        //this.ssdoKernel(camera)
        this.combineKernel()
        this.presentKernel(this.renderResultTexture)
        await ti.sync()
    }
}