/// <reference types="dist" />
import { Field } from "../data/Field";
export declare const fragShader = "\nstruct StageInput {\n  @location(5) fragPos: vec2<f32>;\n};\nstruct StageOutput {\n  @location(0) color: vec4<f32>;\n};\n\nstruct RootBufferType {\n    member: array<f32>;\n};\n\n@group(0) @binding(0)\nvar<storage, read_write> rootBuffer: RootBufferType;\n\nstruct UniformBufferType {\n  width : i32;\n  height : i32;\n  offset: i32;\n};\n\n@group(0) @binding(1)\nvar<uniform> ubo : UniformBufferType;\n\n\n@stage(fragment)\nfn main (input: StageInput) -> StageOutput {\n    var fragPos = input.fragPos;\n    fragPos = (fragPos + 1.0 ) / 2.0 ;\n    \n    var working = vec4<f32>(fragPos,0.0, 1.0);\n\n    var cellPos = vec2<i32>(i32(fragPos.x*f32(ubo.width)), i32(fragPos.y*f32(ubo.height)));\n    var pixelIndex = cellPos.x * ubo.height + cellPos.y;\n    //pixelIndex = cellPos.y * ubo.width + cellPos.x;\n    var result = vec4<f32>(\n        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 0]),\n        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 1]),\n        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 2]),\n        (rootBuffer.member[ubo.offset + pixelIndex * 4 + 3])\n    );\n    var output: StageOutput;\n    output.color = result;\n    return output;\n}\n";
declare class SetImage {
    htmlCanvas: HTMLCanvasElement;
    adapter: GPUAdapter;
    device: GPUDevice;
    context: GPUCanvasContext | null;
    vertexBuffer: GPUBuffer | null;
    uniformBuffer: GPUBuffer | null;
    pipeline: GPURenderPipeline | null;
    presentationFormat: GPUTextureFormat | null;
    constructor(htmlCanvas: HTMLCanvasElement);
    initForCanvas(): void;
    init(): void;
    render(image: Field): void;
}
export { SetImage };
