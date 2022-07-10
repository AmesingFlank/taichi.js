
import { Field } from "../../data/Field"
import { SetImage } from "./SetImage"
import * as ti from "../../taichi"
import { Texture } from "../Textures"
import { DepthTexture } from "../../data/Texture"
class Canvas {
    constructor(public htmlCanvas: HTMLCanvasElement) {
        this.setImageObj = new SetImage(htmlCanvas)
    }
    private setImageObj: SetImage
    async setImage(image: Field | Texture | DepthTexture) {
        await this.setImageObj.render(image)
    }
}

export { Canvas }