import { CompiledKernel } from "../../runtime/Kernel";
import { Scope } from "./Scope";
export declare class Template {
}
export declare class TemplateKernel {
    instances: [
        Map<string, any>,
        CompiledKernel
    ][];
    findInstance(templateArgs: Map<string, any>): CompiledKernel | null;
}
export declare class KernelFactory {
    static templateKernelCache: Map<string, TemplateKernel>;
    static kernel(scope: Scope, argTypes: any, code: any): ((...args: any[]) => void);
}
