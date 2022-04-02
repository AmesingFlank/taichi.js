import type { SNodeTree } from './SNodeTree'
import { NativeTaichiAny, nativeTaichi } from "../native/taichi/GetTaichi"
import { MatrixType, PrimitiveType, StructType, Type, TypeCategory, TypeUtils, VectorType } from "../frontend/Type"
import { Program } from "./Program"
import { assert, error } from '../utils/Logging'
import { MultiDimensionalArray } from '../utils/MultiDimensionalArray'
import { elementToInt32Array, groupElements, reshape, toElement } from '../utils/Utils'
import { FieldTextureCopyDirection } from '../backend/Runtime'

class Field {
    constructor(
        public snodeTree: SNodeTree,
        public offsetBytes: number,
        public sizeBytes: number,
        public dimensions: number[],
        public placeNodes: NativeTaichiAny[],
        public elementType: Type
    ) {

    }

    async toArray1D(): Promise<number[]> {
        if (TypeUtils.isTensorType(this.elementType)) {
            let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this);
            if (TypeUtils.getPrimitiveType(this.elementType) === PrimitiveType.f32) {
                return copy.floatArray;
            }
            else {
                return copy.intArray;
            }
        }
        else {
            error("toArray1D can only be used for scalar/vector/matrix fields")
            return []
        }
    }

    private ensureMaterialized() {
        Program.getCurrentProgram().materializeCurrentTree()
    }

    async toArray(): Promise<any[]> {
        this.ensureMaterialized()
        let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this);
        let elements1D = groupElements(copy.intArray, copy.floatArray, this.elementType)
        return reshape(elements1D, this.dimensions)
    }

    async get(indices: number[]): Promise<any> {
        this.ensureMaterialized()
        if (indices.length !== this.dimensions.length) {
            error(`indices dimensions mismatch, expecting ${this.dimensions.length}, received ${indices.length}`,)
        }
        for (let i = 0; i < indices.length; ++i) {
            assert(indices[i] < this.dimensions[i], "index out of bounds")
        }
        let index = 0;
        for (let i = 0; i < indices.length - 1; ++i) {
            index = (index + indices[i]) * this.dimensions[i + 1]
        }
        index += indices[indices.length - 1]
        let elementSizeBytes = this.elementType.getPrimitivesList().length * 4
        let offsetBytes = elementSizeBytes * index
        let copy = await Program.getCurrentProgram().runtime!.deviceToHost(this, offsetBytes, elementSizeBytes);
        return toElement(copy.intArray, copy.floatArray, this.elementType)
    }

    async fromArray1D(values: number[]) {
        assert(TypeUtils.isTensorType(this.elementType), "fromArray1D can only be used on fields of scalar/vector/matrix types")
        this.ensureMaterialized()
        assert(values.length * 4 === this.sizeBytes, "size mismatch")

        if (TypeUtils.getPrimitiveType(this.elementType) === PrimitiveType.i32) {
            let intArray = Int32Array.from(values)
            await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray)
        }
        else {
            let floatArray = Float32Array.from(values)
            let intArray = new Int32Array(floatArray.buffer)
            await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray)
        }
    }

    async fromArray(values: any) {
        this.ensureMaterialized()
        let curr = values
        for (let i = 0; i < this.dimensions.length; ++i) {
            if (!Array.isArray(curr)) {
                error("expecting array")
            }
            if (curr.length !== this.dimensions[i]) {
                error("array size mismatch")
            }
            curr = curr[0]
        }
        let values1D = values.flat(this.dimensions.length - 1)

        let int32Arrays: Int32Array[] = []
        // slow. hmm. fix later
        for (let val of values1D) {
            int32Arrays.push(elementToInt32Array(val, this.elementType))
        }

        let elementLength = int32Arrays[0].length
        let totalLength = int32Arrays.length * elementLength
        let result = new Int32Array(totalLength)
        for (let i = 0; i < int32Arrays.length; ++i) {
            result.set(int32Arrays[i], i * elementLength)
        }

        await Program.getCurrentProgram().runtime!.hostToDevice(this, result)
    }

    async set(indices: number[], value: any) {
        this.ensureMaterialized()
        if (indices.length !== this.dimensions.length) {
            error(`indices dimensions mismatch, expecting ${this.dimensions.length}, received ${indices.length}`,)
        }
        for (let i = 0; i < indices.length; ++i) {
            assert(indices[i] < this.dimensions[i], "index out of bounds")
        }
        let index = 0;
        for (let i = 0; i < indices.length - 1; ++i) {
            index = (index + indices[i]) * this.dimensions[i + 1]
        }
        index += indices[indices.length - 1]
        let elementSizeBytes = this.elementType.getPrimitivesList().length * 4
        let offsetBytes = elementSizeBytes * index

        let intArray = elementToInt32Array(value, this.elementType)
        await Program.getCurrentProgram().runtime!.hostToDevice(this, intArray, offsetBytes)
    }
}


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


export { Field, TextureBase, Texture, CanvasTexture, DepthTexture, isTexture, TextureDimensionality, getTextureCoordsNumComponents, toNativeImageDimensionality }