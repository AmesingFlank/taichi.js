import { Field } from "../../data/Field";
import { CanvasTexture, Texture } from "../../data/Texture";
declare class SetImage {
    htmlCanvas: HTMLCanvasElement;
    VBO: Field;
    IBO: Field;
    renderTarget: CanvasTexture;
    stagingTexture: Texture;
    renderFieldKernel: (...args: any[]) => any;
    renderTextureKernel: (...args: any[]) => any;
    constructor(htmlCanvas: HTMLCanvasElement);
    render(image: Field | Texture): Promise<void>;
}
export { SetImage };
