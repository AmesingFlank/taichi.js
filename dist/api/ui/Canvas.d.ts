import { Field } from '../../data/Field';
import { Texture } from '../Textures';
import { DepthTexture } from '../../data/Texture';
declare class Canvas {
    htmlCanvas: HTMLCanvasElement;
    constructor(htmlCanvas: HTMLCanvasElement);
    private setImageObj;
    setImage(image: Field | Texture | DepthTexture): Promise<void>;
}
export { Canvas };
