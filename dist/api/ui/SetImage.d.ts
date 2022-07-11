import { Field } from "../../data/Field";
import { CanvasTexture, DepthTexture, Texture } from "../../data/Texture";
declare class SetImage {
    htmlCanvas: HTMLCanvasElement;
    VBO: Field;
    IBO: Field;
    renderTarget: CanvasTexture;
    renderFieldKernel: (...args: any[]) => any;
    renderTextureKernel: (...args: any[]) => any;
    renderDepthTextureKernel: (...args: any[]) => any;
    constructor(htmlCanvas: HTMLCanvasElement);
    render(image: Field | Texture | DepthTexture): Promise<void>;
}
export { SetImage };
