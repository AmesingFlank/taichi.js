import { taichiExample6Fractal } from './examples/taichi6_fractal/main';
import { taichiExample7VortexRing } from './examples/taichi7_vortex_ring/main';
import { Canvas } from "./ui/Canvas";
import { runAllTests } from "./tests/All";
import { init } from './api/Init';
import { addToKernelScope, clearKernelScope, kernel, func, sync, template } from './api/Lang';
import { field } from "./api/Fields";
import { range, ndrange } from "./api/KernelScopeBuiltin";
declare const ti: {
    taichiExample6Fractal: typeof taichiExample6Fractal;
    taichiExample7VortexRing: typeof taichiExample7VortexRing;
    simpleGraphicsExample: (htmlCanvas: HTMLCanvasElement) => Promise<void>;
    clothExample: (htmlCanvas: HTMLCanvasElement) => Promise<void>;
    runAllTests: typeof runAllTests;
    init: typeof init;
    kernel: typeof kernel;
    func: typeof func;
    template: typeof template;
    addToKernelScope: typeof addToKernelScope;
    clearKernelScope: typeof clearKernelScope;
    field: typeof field;
    Vector: {
        field: (n: number, primitiveType: import("./frontend/Type").PrimitiveType, dimensions: number | number[]) => import("./data/Field").Field;
    };
    Matrix: {
        field: (n: number, m: number, primitiveType: import("./frontend/Type").PrimitiveType, dimensions: number | number[]) => import("./data/Field").Field;
    };
    Struct: {
        field: (members: any, dimensions: number | number[]) => import("./data/Field").Field;
    };
    texture: (numComponents: number, dimensions: number[]) => import("./data/Texture").Texture;
    canvasTexture: (canvas: HTMLCanvasElement) => import("./data/Texture").CanvasTexture;
    depthTexture: (dimensions: number[]) => import("./data/Texture").DepthTexture;
    i32: import("./frontend/Type").PrimitiveType;
    f32: import("./frontend/Type").PrimitiveType;
    range: typeof range;
    ndrange: typeof ndrange;
    sync: typeof sync;
    types: {
        vector(primitiveType: import("./frontend/Type").PrimitiveType, n: number): import("./frontend/Type").VectorType;
        matrix(primitiveType: import("./frontend/Type").PrimitiveType, n: number, m: number): import("./frontend/Type").MatrixType;
        struct(members: any): import("./frontend/Type").StructType;
    };
    Canvas: typeof Canvas;
};
export { ti };
