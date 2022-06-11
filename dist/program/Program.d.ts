import { Runtime } from "../runtime/Runtime";
import { SNodeTree } from "../data/SNodeTree";
import { NativeTaichiAny } from "../native/taichi/GetTaichi";
import { Scope } from "../language/frontend/Scope";
import { TextureBase } from "../data/Texture";
declare class Program {
    runtime: Runtime | null;
    partialTree: SNodeTree;
    nativeProgram: NativeTaichiAny;
    nativeAotBuilder: NativeTaichiAny;
    kernelScope: Scope;
    private static instance;
    private constructor();
    static getCurrentProgram(): Program;
    materializeRuntime(): Promise<void>;
    materializeCurrentTree(): void;
    addTexture(texture: TextureBase): void;
    addToKernelScope(obj: any): void;
    clearKernelScope(): void;
    private nextAnonymousKernel;
    getAnonymousKernelName(): string;
    private nextFunction;
    getNextFunctionID(): string;
}
export { Program };
