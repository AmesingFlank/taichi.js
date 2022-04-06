import { ResourceBinding } from "../backend/Kernel";
declare function getWgslShaderBindings(wgsl: string): ResourceBinding[];
declare enum WgslShaderStage {
    Compute = 0,
    Vertex = 1,
    Fragment = 2
}
declare function getWgslShaderStage(wgsl: string): WgslShaderStage;
export { getWgslShaderBindings, WgslShaderStage, getWgslShaderStage };
