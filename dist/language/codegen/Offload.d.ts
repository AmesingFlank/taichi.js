import { IRModule } from "../ir/Stmt";
export declare enum OffloadType {
    Serial = 0,
    Compute = 1,
    Vertex = 2,
    Fragment = 3
}
export declare class OffloadedModule extends IRModule {
    type: OffloadType;
    constructor(type: OffloadType);
}
export declare class SerialModule extends OffloadedModule {
    constructor();
}
export declare class ComputeModule extends OffloadedModule {
    rangeArg: number;
    hasConstRange: boolean;
    constructor(rangeArg: number, hasConstRange: boolean);
}
export declare class VertexModule extends OffloadedModule {
    constructor();
}
export declare class FragmentModule extends OffloadedModule {
    constructor();
}
export declare function offload(module: IRModule): OffloadedModule[];
