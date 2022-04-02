
import { Field } from "../data/Field"
import {SetImage} from "./SetImage"

class Canvas{
    constructor(public htmlCanvas: HTMLCanvasElement){
        this.setImageObj = new SetImage(htmlCanvas)
    }
    private setImageObj: SetImage
    async setImage(image:Field){
        await this.setImageObj.render(image)
    }
}

export {Canvas}