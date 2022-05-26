import { Texture } from "../Textures";
export declare class HdrLoader {
    private static getImgFieldToTextureKernel;
    private static imgFieldToTexture;
    static loadFromURL(url: string): Promise<Texture>;
}
