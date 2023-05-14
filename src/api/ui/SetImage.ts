import { Field } from '../../data/Field';
import { CanvasTexture, DepthTexture, Texture, TextureBase } from '../../data/Texture';
import { Program } from '../../program/Program';
import * as ti from '../../taichi';
class SetImage {
    VBO: Field;
    IBO: Field;
    renderTarget: CanvasTexture;
    renderFieldKernel: (...args: any[]) => any;
    renderTextureKernel: (...args: any[]) => any;
    renderDepthTextureKernel: (...args: any[]) => any;

    constructor(public htmlCanvas: HTMLCanvasElement) {
        this.VBO = ti.Vector.field(2, ti.f32, [4]);
        this.IBO = ti.field(ti.i32, [6]);
        this.renderTarget = ti.canvasTexture(htmlCanvas);
        this.VBO.fromArray([
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
        ]);
        this.IBO.fromArray([0, 1, 2, 1, 3, 2]);
        this.renderFieldKernel = ti.classKernel(this, { image: ti.template() }, (image: any) => {
            ti.clearColor(this.renderTarget, [0.0, 0.0, 0.0, 1]);
            for (let v of ti.inputVertices(this.VBO, this.IBO)) {
                ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                ti.outputVertex(v);
            }
            for (let f of ti.inputFragments()) {
                let coord = (f + 1) / 2.0;
                //@ts-ignore
                let texelIndex = ti.i32(coord * (image.dimensions - 1));
                let color = image[texelIndex].rgb;
                ti.outputColor(this.renderTarget, color.concat([1.0]));
            }
        });
        this.renderTextureKernel = ti.classKernel(this, { image: ti.template() }, (image: TextureBase) => {
            ti.clearColor(this.renderTarget, [0.0, 0.0, 0.0, 1]);
            for (let v of ti.inputVertices(this.VBO, this.IBO)) {
                ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                ti.outputVertex(v);
            }
            for (let f of ti.inputFragments()) {
                let coord = (f + 1) / 2.0;
                let color = ti.textureSample(image, coord);
                color[3] = 1.0;
                ti.outputColor(this.renderTarget, color);
            }
        });
        this.renderDepthTextureKernel = ti.classKernel(this, { image: ti.template() }, (image: DepthTexture) => {
            ti.clearColor(this.renderTarget, [0.0, 0.0, 0.0, 1]);
            for (let v of ti.inputVertices(this.VBO, this.IBO)) {
                ti.outputPosition([v.x, v.y, 0.0, 1.0]);
                ti.outputVertex(v);
            }
            for (let f of ti.inputFragments()) {
                let coord = (f + 1) / 2.0;
                //@ts-ignore
                let texelIndex = ti.i32(coord * (image.dimensions - 1));
                let depth = ti.textureLoad(image, texelIndex);
                let color = [depth, depth, depth, 1.0];
                ti.outputColor(this.renderTarget, color);
            }
        });
    }

    async render(image: Field | Texture | DepthTexture) {
        if (image instanceof Field) {
            await this.renderFieldKernel(image);
        } else if (image instanceof DepthTexture) {
            await this.renderDepthTextureKernel(image);
        } else {
            await this.renderTextureKernel(image);
        }
    }
}

export { SetImage };
