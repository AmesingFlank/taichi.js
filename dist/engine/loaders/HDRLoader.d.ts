import { Texture } from '../../api/Textures';
export declare class HdrTexture {
    texture: Texture;
    exposure: number;
    constructor(texture: Texture, exposure: number);
}
export declare class HdrLoader {
    private static getImgFieldToTextureKernel;
    private static imgFieldToTexture;
    static loadFromURL(url: string): Promise<HdrTexture>;
}
