import { Runtime } from "../runtime/Runtime";
import { SNodeTree } from "../data/SNodeTree";
import { Scope } from "../language/frontend/Scope";
import { TextureBase } from "../data/Texture";
export interface ProgramOptions {
    printIR: boolean;
    printWGSL: boolean;
}
declare class Program {
    options: ProgramOptions;
    init(options?: ProgramOptions): Promise<void>;
    runtime: Runtime | null;
    partialTree: SNodeTree;
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
