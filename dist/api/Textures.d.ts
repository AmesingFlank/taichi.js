import { CanvasTexture, CubeTexture, DepthTexture, Texture, TextureSamplingOptions, WrapMode } from '../data/Texture';
declare let texture: (numComponents: number, dimensions: number[], sampleCount?: number, samplingOptions?: TextureSamplingOptions) => Texture;
declare let canvasTexture: (canvas: HTMLCanvasElement, sampleCount?: number) => CanvasTexture;
declare let depthTexture: (dimensions: number[], sampleCount?: number) => DepthTexture;
export { texture, canvasTexture, depthTexture, Texture, CubeTexture, TextureSamplingOptions, WrapMode };
