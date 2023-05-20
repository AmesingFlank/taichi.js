import { Program } from '../program/Program';
import { assert, error } from '../utils/Logging';

export enum TextureDimensionality {
    Dim2d,
    Dim3d,
    DimCube,
}

export function getTextureCoordsNumComponents(dim: TextureDimensionality): number {
    switch (dim) {
        case TextureDimensionality.Dim2d: {
            return 2;
        }
        case TextureDimensionality.DimCube: {
            return 3;
        }
        case TextureDimensionality.Dim3d: {
            return 3;
        }
        default: {
            error('unrecognized dimensionality');
            return 2;
        }
    }
}

export abstract class TextureBase {
    abstract getGPUTextureFormat(): GPUTextureFormat;
    abstract canUseAsRengerTarget(): boolean;
    abstract getGPUTexture(): GPUTexture;
    abstract getGPUTextureView(): GPUTextureView;
    abstract getGPUSampler(): GPUSampler; // TODO rethink this... samplers and texture probably should be decoupled?
    abstract getTextureDimensionality(): TextureDimensionality;
    textureId: number = -1;
    sampleCount: number = 1;
}

export enum WrapMode {
    Repeat = 'repeat',
    ClampToEdge = 'clamp-to-edge',
    MirrorRepeat = 'mirror-repeat',
}

export interface TextureSamplingOptions {
    wrapModeU?: WrapMode;
    wrapModeV?: WrapMode;
    wrapModeW?: WrapMode;
}

export class Texture extends TextureBase {
    constructor(
        public numComponents: number,
        public dimensions: number[],
        sampleCount: number,
        public samplingOptions: TextureSamplingOptions
    ) {
        super();
        this.sampleCount = sampleCount;
        assert(dimensions.length <= 3 && dimensions.length >= 1, 'texture dimensions must be >= 1 and <= 3');
        assert(
            numComponents === 1 || numComponents === 2 || numComponents === 4,
            'texture dimensions must be 1, 2, or 4'
        );
        this.texture = Program.getCurrentProgram().runtime!.createGPUTexture(
            dimensions,
            this.getTextureDimensionality(),
            this.getGPUTextureFormat(),
            this.canUseAsRengerTarget(),
            true,
            1
        );
        if (this.sampleCount > 1) {
            this.multiSampledRenderTexture = Program.getCurrentProgram().runtime!.createGPUTexture(
                dimensions,
                this.getTextureDimensionality(),
                this.getGPUTextureFormat(),
                this.canUseAsRengerTarget(),
                false,
                sampleCount
            );
        }
        Program.getCurrentProgram().addTexture(this);
        this.textureView = this.texture.createView();
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(false, samplingOptions);
    }

    private texture: GPUTexture;
    private textureView: GPUTextureView;
    private sampler: GPUSampler;
    multiSampledRenderTexture: GPUTexture | null = null;

    getGPUTextureFormat(): GPUTextureFormat {
        switch (this.numComponents) {
            // 32bit float types cannot be filtered (and thus sampled)
            case 1:
                return 'r16float';
            case 2:
                return 'rg16float';
            case 4:
                return 'rgba16float';
            default:
                error('unsupported component count');
                return 'rgba16float';
        }
    }

    canUseAsRengerTarget() {
        return true;
    }

    getGPUTexture(): GPUTexture {
        return this.texture;
    }

    getGPUTextureView(): GPUTextureView {
        return this.textureView;
    }

    getGPUSampler(): GPUSampler {
        return this.sampler;
    }

    getTextureDimensionality(): TextureDimensionality {
        switch (this.dimensions.length) {
            case 2:
                return TextureDimensionality.Dim2d;
            case 3:
                return TextureDimensionality.Dim3d;
            default:
                error('unsupported dimensionality');
                return TextureDimensionality.Dim2d;
        }
    }

    async copyFrom(src: Texture) {
        assert(this.getTextureDimensionality() === src.getTextureDimensionality(), 'texture dimensionality mismatch');
        for (let i = 0; i < this.dimensions.length; ++i) {
            assert(this.dimensions[i] === src.dimensions[i], 'texture shape mismatch');
        }
        await Program.getCurrentProgram().runtime!.copyTextureToTexture(
            src.getGPUTexture(),
            this.getGPUTexture(),
            this.dimensions
        );
    }

    static async createFromBitmap(bitmap: ImageBitmap) {
        let dimensions = [bitmap.width, bitmap.height];
        let texture = new Texture(4, dimensions, 1, {});
        await Program.getCurrentProgram().runtime!.copyImageBitmapToTexture(bitmap, texture.getGPUTexture());
        return texture;
    }

    static async createFromHtmlImage(image: HTMLImageElement) {
        let bitmap = await createImageBitmap(image);
        return await this.createFromBitmap(bitmap);
    }

    static async createFromURL(url: string): Promise<Texture> {
        let img = new Image();
        img.src = url;
        await img.decode();
        return await this.createFromHtmlImage(img);
    }
}

export class CanvasTexture extends TextureBase {
    constructor(public htmlCanvas: HTMLCanvasElement, sampleCount: number) {
        super();
        let contextAndFormat = Program.getCurrentProgram().runtime!.createGPUCanvasContext(htmlCanvas);
        this.context = contextAndFormat[0];
        this.format = contextAndFormat[1];
        Program.getCurrentProgram().addTexture(this);
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(false, {});
        this.sampleCount = sampleCount;
        this.dimensions = [htmlCanvas.width, htmlCanvas.height];
        if (this.sampleCount > 1) {
            this.multiSampledRenderTexture = Program.getCurrentProgram().runtime!.createGPUTexture(
                this.dimensions,
                this.getTextureDimensionality(),
                this.getGPUTextureFormat(),
                this.canUseAsRengerTarget(),
                false,
                sampleCount
            );
        }
    }
    dimensions: number[];
    multiSampledRenderTexture: GPUTexture | null = null;
    context: GPUCanvasContext;
    format: GPUTextureFormat;
    private sampler: GPUSampler;

    getGPUTextureFormat(): GPUTextureFormat {
        return this.format;
    }

    canUseAsRengerTarget() {
        return true;
    }

    getGPUTexture(): GPUTexture {
        return this.context.getCurrentTexture();
    }

    getGPUTextureView(): GPUTextureView {
        return this.context.getCurrentTexture().createView();
    }

    getGPUSampler(): GPUSampler {
        return this.sampler;
    }

    getTextureDimensionality(): TextureDimensionality {
        return TextureDimensionality.Dim2d;
    }
}

export class DepthTexture extends TextureBase {
    constructor(public dimensions: number[], sampleCount: number) {
        super();
        assert(dimensions.length === 2, 'depth texture must be 2D');
        this.texture = Program.getCurrentProgram().runtime!.createGPUTexture(
            dimensions,
            this.getTextureDimensionality(),
            this.getGPUTextureFormat(),
            this.canUseAsRengerTarget(),
            false,
            sampleCount
        );
        Program.getCurrentProgram().addTexture(this);
        this.textureView = this.texture.createView();
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(true, {});
        this.sampleCount = sampleCount;
    }

    private texture: GPUTexture;
    private textureView: GPUTextureView;
    private sampler: GPUSampler;

    getGPUTextureFormat(): GPUTextureFormat {
        return 'depth32float';
    }

    canUseAsRengerTarget() {
        return true;
    }

    getGPUTexture(): GPUTexture {
        return this.texture;
    }
    getTextureDimensionality(): TextureDimensionality {
        return TextureDimensionality.Dim2d;
    }
    getGPUTextureView(): GPUTextureView {
        return this.textureView;
    }
    getGPUSampler(): GPUSampler {
        return this.sampler;
    }
}

export class CubeTexture extends TextureBase {
    constructor(public dimensions: number[]) {
        super();
        assert(dimensions.length === 2, 'cube texture must be 2D');
        this.texture = Program.getCurrentProgram().runtime!.createGPUTexture(
            dimensions,
            this.getTextureDimensionality(),
            this.getGPUTextureFormat(),
            this.canUseAsRengerTarget(),
            false,
            1
        );
        Program.getCurrentProgram().addTexture(this);
        this.textureView = this.texture.createView({ dimension: 'cube' });
        this.sampler = Program.getCurrentProgram().runtime!.createGPUSampler(false, {});
        this.sampleCount = 1;
    }

    private texture: GPUTexture;
    private textureView: GPUTextureView;
    private sampler: GPUSampler;

    getGPUTextureFormat(): GPUTextureFormat {
        return 'rgba16float';
    }

    canUseAsRengerTarget() {
        return true;
    }

    getGPUTexture(): GPUTexture {
        return this.texture;
    }
    getTextureDimensionality(): TextureDimensionality {
        return TextureDimensionality.DimCube;
    }
    getGPUTextureView(): GPUTextureView {
        return this.textureView;
    }
    getGPUSampler(): GPUSampler {
        return this.sampler;
    }
    static async createFromBitmap(bitmaps: ImageBitmap[]): Promise<CubeTexture> {
        for (let bitmap of bitmaps) {
            assert(
                bitmap.width === bitmaps[0].width && bitmap.height === bitmaps[0].height,
                'all 6 images in a cube texture must have identical dimensions'
            );
        }

        let dimensions = [bitmaps[0].width, bitmaps[0].height];
        let texture = new CubeTexture(dimensions);
        await Program.getCurrentProgram().runtime!.copyImageBitmapsToCubeTexture(bitmaps, texture.getGPUTexture());
        return texture;
    }
    static async createFromHtmlImage(images: HTMLImageElement[]): Promise<CubeTexture> {
        let bitmaps: ImageBitmap[] = [];
        for (let img of images) {
            bitmaps.push(await createImageBitmap(img));
        }
        return await this.createFromBitmap(bitmaps);
    }
    static async createFromURL(urls: string[]): Promise<CubeTexture> {
        let imgs: HTMLImageElement[] = [];
        for (let url of urls) {
            let img = new Image();
            img.src = url;
            await img.decode();
            imgs.push(img);
        }
        return await this.createFromHtmlImage(imgs);
    }
}

export function isTexture(x: any) {
    return x instanceof Texture || x instanceof CanvasTexture || x instanceof DepthTexture || x instanceof CubeTexture;
}
