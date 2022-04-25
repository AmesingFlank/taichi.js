import { Field } from "../../data/Field"
import { CanvasTexture, Texture } from "../../data/Texture"
import { Program } from "../../program/Program"
import * as ti from "../../taichi"
class SetImage {
    VBO: Field
    IBO: Field
    renderTarget: CanvasTexture
    stagingTexture: Texture
    renderKernel: (...args: any[]) => any

    constructor(public htmlCanvas: HTMLCanvasElement) {
        this.VBO = ti.Vector.field(2, ti.f32, [4]);
        this.IBO = ti.field(ti.i32, [6]);
        this.renderTarget = ti.canvasTexture(htmlCanvas)
        this.stagingTexture = ti.texture(4, [htmlCanvas.width, htmlCanvas.height])
        this.VBO.fromArray([
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1]
        ])
        this.IBO.fromArray([0, 1, 2, 1, 3, 2])
        this.renderKernel = ti.classKernel(this,
            { image: ti.template() },
            `
            (image) => {
                for (let I of ti.ndrange(this.htmlCanvas.width, this.htmlCanvas.height)) {
                    let srcX = ti.i32(I[0] * image.dimensions[0] / this.htmlCanvas.width)
                    let srcY = ti.i32(I[1] * image.dimensions[1] / this.htmlCanvas.height)
                    ti.textureStore(this.stagingTexture, I, image[[srcX, srcY]])
                }
                ti.clearColor(this.renderTarget, [0.0, 0.0, 0.0, 1]);
                for (let v of ti.inputVertices(this.VBO, this.IBO)) {
                    ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                    ti.outputVertex(v);
                }
                for (let f of ti.inputFragments()) {
                    let coord = (f + 1) / 2.0
                    let color = ti.textureSample(this.stagingTexture, coord)
                    color[3] = 1.0
                    ti.outputColor(this.renderTarget, color)
                }
            }
            `
        )
    }



    render(image: Field) {
        this.renderKernel(image);
    }


}

export { SetImage }