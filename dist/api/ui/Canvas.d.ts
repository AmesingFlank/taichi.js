import { Field } from "../../data/Field";
import { Texture } from "../Textures";
declare class Canvas {
    htmlCanvas: HTMLCanvasElement;
    constructor(htmlCanvas: HTMLCanvasElement);
    private setImageObj;
    setImage(image: Field | Texture): Promise<void>;
}
export { Canvas };
