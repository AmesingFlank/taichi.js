import { CanvasTexture, CubeTexture, DepthTexture, Texture } from '../data/Texture';
declare let texture: (numComponents: number, dimensions: number[], sampleCount?: number) => Texture;
declare let canvasTexture: (canvas: HTMLCanvasElement, sampleCount?: number) => CanvasTexture;
declare let depthTexture: (dimensions: number[], sampleCount?: number) => DepthTexture;
export { texture, canvasTexture, depthTexture, Texture, CubeTexture };
