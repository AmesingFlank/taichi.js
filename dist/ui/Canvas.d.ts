import { Field } from "../data/Field";
declare class Canvas {
    htmlCanvas: HTMLCanvasElement;
    constructor(htmlCanvas: HTMLCanvasElement);
    private setImageObj;
    setImage(image: Field): Promise<void>;
}
export { Canvas };
