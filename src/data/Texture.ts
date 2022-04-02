import type { SNodeTree } from './SNodeTree'
import { NativeTaichiAny, nativeTaichi } from "../native/taichi/GetTaichi"
import { MatrixType, PrimitiveType, StructType, Type, TypeCategory, TypeUtils, VectorType } from "../frontend/Type"
import { Program } from "../program/Program"
import { assert, error } from '../utils/Logging'
import { MultiDimensionalArray } from '../utils/MultiDimensionalArray'
import { elementToInt32Array, groupElements, reshape, toElement } from '../utils/Utils'


enum TextureDimensionality {
    Dim2d
}

function toNativeImageDimensionality(dim: TextureDimensionality): NativeTaichiAny {
    switch (dim) {
        case TextureDimensionality.Dim2d: {
            return nativeTaichi.TextureDimensionality.Dim2d;
        }
        default: {
            error("unrecognized dimensionality")
            return TextureDimensionality.Dim2d
        }
    }
}

function getTextureCoordsNumComponents(dim: TextureDimensionality): number {
    switch (dim) {
        case TextureDimensionality.Dim2d: {
            return 2;
        }
        default: {
            error("unrecognized dimensionality")
            return 2
        }
    }
}

abstract class TextureBase {
    abstract getGPUTextureFormat(): GPUTextureFormat
    abstract canUseAsRengerTarget(): boolean;
    abstract getGPUTexture(): GPUTexture;
    abstract getGPUTextureView(): GPUTextureView;
    abstract getGPUSampler(): GPUSampler; // TODO rethink this... samplers and texture probably should be decoupled?
    abstract getTextureDimensionality(): TextureDimensionality
    textureId: number = -1
    nativeTexture: NativeTaichiAny
}

class Texture extends TextureBase {
    constructor(
        public numComponents: number,
        public dimensions: number[],
    ) {
        super()
        assert(dimensions.length <= 3 && dimensions.length >= 1, "texture dimensions must be >= 1 and <= 3")
        assert(numComponents === 1 || numComponents === 2 || numComponents === 4, "texture dimensions must be 1, 2, or 4")
        this.texture = Program.getCurrentProgram().runtime!.createGPUTexture(dimensions, this.getGPUTextureFormat(), this.canUseAsRengerTarget(), true)
        Program.getCurrentProgram().addTexture(this)
        this.textureView = this.texture.createView()
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(false)
    }

    private texture: GPUTexture
    private textureView: GPUTextureView
    private sampler: GPUSampler

    getGPUTextureFormat(): GPUTextureFormat { 
        switch (this.numComponents) {
            // 32bit float types cannot be filtered (and thus sampled)
            case 1: return "r16float"
            case 2: return "rg16float"
            case 4: return "rgba16float"
            default:
                error("unsupported component count")
                return "rgba16float"
        }
    }

    canUseAsRengerTarget() {
        return true
    }

    getGPUTexture(): GPUTexture {
        return this.texture
    }

    getGPUTextureView(): GPUTextureView {
        return this.textureView
    }

    getGPUSampler(): GPUSampler {
        return this.sampler
    }

    getTextureDimensionality(): TextureDimensionality {
        switch (this.dimensions.length) {
            case 2:
                return TextureDimensionality.Dim2d
            default:
                error("unsupported dimensionality")
                return TextureDimensionality.Dim2d
        }
    }
}

class CanvasTexture extends TextureBase {
    constructor(public htmlCanvas: HTMLCanvasElement) {
        super()
        let contextAndFormat = Program.getCurrentProgram().runtime!.createGPUCanvasContext(htmlCanvas)
        this.context = contextAndFormat[0]
        this.format = contextAndFormat[1]
        Program.getCurrentProgram().addTexture(this)
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(false)
    }
    context: GPUCanvasContext
    format: GPUTextureFormat
    private sampler: GPUSampler

    getGPUTextureFormat(): GPUTextureFormat {
        return this.format
    }

    canUseAsRengerTarget() {
        return true
    }

    getGPUTexture(): GPUTexture {
        return this.context.getCurrentTexture()
    }

    getGPUTextureView(): GPUTextureView {
        return this.context.getCurrentTexture().createView()
    }

    getGPUSampler(): GPUSampler {
        return this.sampler
    }

    getTextureDimensionality(): TextureDimensionality {
        return TextureDimensionality.Dim2d
    }
}

class DepthTexture extends TextureBase {
    constructor(
        public dimensions: number[],
    ) {
        super()
        assert(dimensions.length === 2, "depth texture must be 2D")
        this.texture = Program.getCurrentProgram().runtime!.createGPUTexture(dimensions, this.getGPUTextureFormat(), this.canUseAsRengerTarget(), false)
        Program.getCurrentProgram().addTexture(this)
        this.textureView = this.texture.createView()
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(true)
    }

    private texture: GPUTexture
    private textureView: GPUTextureView
    private sampler: GPUSampler

    getGPUTextureFormat(): GPUTextureFormat {
        return "depth32float"
    }

    canUseAsRengerTarget() {
        return true
    }

    getGPUTexture(): GPUTexture {
        return this.texture
    }
    getTextureDimensionality(): TextureDimensionality {
        return TextureDimensionality.Dim2d
    }
    getGPUTextureView(): GPUTextureView {
        return this.textureView
    }
    getGPUSampler(): GPUSampler {
        return this.sampler
    }

}


function isTexture(x: any) {
    return x instanceof Texture || x instanceof CanvasTexture || x instanceof DepthTexture
}


export { TextureBase, Texture, CanvasTexture, DepthTexture, isTexture, TextureDimensionality, getTextureCoordsNumComponents, toNativeImageDimensionality }