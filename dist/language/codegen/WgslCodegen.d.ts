import { ResourceBinding, ResourceInfo } from "../../runtime/Kernel";
import { PrimitiveType } from "../frontend/Type";
import { ConstStmt, Stmt } from "../ir/Stmt";
import { IRVisitor } from "../ir/Visitor";
import { OffloadedModule } from "./Offload";
export interface CodegenResult {
    code: string;
}
declare class ResourceBindingMap {
    bindings: ResourceBinding[];
    has(resource: ResourceInfo): boolean;
    add(resource: ResourceInfo, bindingPoint: number): void;
    get(resource: ResourceInfo): number | undefined;
    size(): number;
}
declare class StringBuilder {
    parts: string[];
    write(...args: (string | number)[]): void;
    getString(): string;
}
export declare class CodegenVisitor extends IRVisitor {
    offload: OffloadedModule;
    bindingPointBegin: number;
    constructor(offload: OffloadedModule, bindingPointBegin?: number);
    visitConstStmt(stmt: ConstStmt): void;
    globalDecls: StringBuilder;
    stageInStructBegin: StringBuilder;
    stageInStructBody: StringBuilder;
    stageInStructEnd: StringBuilder;
    stageOutStructBegin: StringBuilder;
    stageOutStructBody: StringBuilder;
    stageOutStructEnd: StringBuilder;
    funtionSignature: StringBuilder;
    functionBodyPrologue: StringBuilder;
    body: StringBuilder;
    functionBodyEpilogue: StringBuilder;
    functionEnd: StringBuilder;
    assembleShader(): string;
    bodyIndentCount: number;
    indent(): void;
    dedent(): void;
    getIndentation(): string;
    emitLet(name: string, type: string): void;
    emitVar(name: string, type: string): void;
    getPointerIntTypeName(): string;
    getPrimitiveTypeName(dt: PrimitiveType): "f32" | "i32" | "error";
    getScalarOrVectorTypeName(dt: PrimitiveType, numComponents: number): string;
    getScalarOrVectorExpr(values: Stmt[], typeName: string): string;
    getElementCount(buffer: ResourceInfo): void;
    resourceBindings: ResourceBindingMap;
    getBufferName(buffer: ResourceInfo): string;
    getBufferMemberName(buffer: ResourceInfo): string;
    randInitiated: boolean;
    initRand(): void;
    isVertexFor(): boolean;
    isFragmentFor(): boolean;
    enforce16BytesAlignment(): boolean;
    getRawDataTypeName(): "i32" | "vec4<i32>";
}
export {};
