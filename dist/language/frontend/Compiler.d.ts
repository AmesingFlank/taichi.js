import * as ts from 'typescript';
import { ASTVisitor, VisitorResult } from './ast/Visiter';
import { ResourceBinding, KernelParams, RenderPipelineParams, RenderPassParams } from '../../runtime/Kernel';
import { Scope } from './Scope';
import { TextureBase } from '../../data/Texture';
import { Type, PrimitiveType } from './Type';
import { Value } from './Value';
import { BuiltinOp, BuiltinAtomicOp } from './BuiltinOp';
import { ResultOrError } from './Error';
import { ParsedFunction } from './ParsedFunction';
import { IRBuilder } from '../ir/Builder';
declare enum LoopKind {
    For = 0,
    While = 1,
    VertexFor = 2,
    FragmentFor = 3
}
declare type SymbolTable = Map<ts.Symbol, Value>;
declare class CompilingVisitor extends ASTVisitor<Value> {
    protected irBuilder: IRBuilder;
    protected builtinOps: Map<string, BuiltinOp>;
    protected atomicOps: Map<string, BuiltinAtomicOp>;
    constructor(irBuilder: IRBuilder, builtinOps: Map<string, BuiltinOp>, atomicOps: Map<string, BuiltinAtomicOp>);
    protected kernelScope: Scope;
    protected templatedValues: Scope;
    protected symbolTable: SymbolTable;
    protected parsedFunction: ParsedFunction | null;
    returnValue: Value | null;
    protected loopStack: LoopKind[];
    protected branchDepth: number;
    protected lastVisitedNode: ts.Node | null;
    protected startedVertex: boolean;
    protected finishedVertex: boolean;
    protected startedFragment: boolean;
    protected renderPipelineParams: RenderPipelineParams[];
    protected currentRenderPipelineParams: RenderPipelineParams | null;
    protected renderPassParams: RenderPassParams | null;
    buildIR(parsedFunction: ParsedFunction, kernelScope: Scope, templatedValues: Scope): void;
    protected visitInputFunctionBody(body: ts.Block | ts.ConciseBody): void;
    protected dispatchVisit(node: ts.Node): VisitorResult<Value>;
    protected extractVisitorResult(result: VisitorResult<Value>): Value;
    protected extractValueOrError(valueOrError: ResultOrError<Value>, node: ts.Node | null, ...args: any): Value;
    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>): void;
    protected hasNodeSymbol(node: ts.Node): boolean;
    protected getNodeSymbol(node: ts.Node): ts.Symbol;
    protected getNodeBaseSymbol(node: ts.Node): ts.Symbol | undefined;
    protected tryEvalInKernelScopeOrTemplateArgs(node: ts.Node): any;
    protected canEvalInKernelScopeOrTemplateArgs(node: ts.Node): boolean;
    protected errorNode(node: ts.Node | null, ...args: any[]): void;
    protected assertNode(node: ts.Node | null, condition: boolean, ...args: any[]): void;
    protected derefIfPointer(val: Value): Value;
    protected createLocalVarCopy(val: Value): Value;
    protected comma(leftValue: Value, rightValue: Value): Value;
    protected castTo(val: Value, primType: PrimitiveType): Value;
    protected visitNumericLiteral(node: ts.NumericLiteral): VisitorResult<Value>;
    protected visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): VisitorResult<Value>;
    protected visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<Value>;
    protected visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): VisitorResult<Value>;
    protected visitObjectLiteralExpression(node: ts.ObjectLiteralExpression): VisitorResult<Value>;
    protected visitParenthesizedExpression(node: ts.ParenthesizedExpression): VisitorResult<Value>;
    protected ensureRenderPassParams(): void;
    protected ensureColorAttachment(target: TextureBase): number;
    protected isBuiltinFunctionWithName(funcText: string, builtinName: string): boolean;
    protected isBuiltinMathFunctionWithName(funcText: string, builtinName: string): boolean;
    protected isRenderingBuiltinFunction(funcText: string): boolean;
    protected handleRenderingBuiltinFunction(funcText: string, argumentValues: Value[], node: ts.CallExpression): VisitorResult<Value>;
    protected visitCallExpression(node: ts.CallExpression): VisitorResult<Value>;
    protected visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<Value>;
    protected visitPropertyAccessExpression(node: ts.PropertyAccessExpression): VisitorResult<Value>;
    protected getValueFromAnyHostValue(val: any): Value;
    protected visitIdentifier(node: ts.Identifier): VisitorResult<Value>;
    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<Value>;
    protected visitIfStatement(node: ts.IfStatement): VisitorResult<Value>;
    protected visitBreakStatement(node: ts.BreakStatement): VisitorResult<Value>;
    protected visitContinueStatement(node: ts.ContinueStatement): VisitorResult<Value>;
    protected visitWhileStatement(node: ts.WhileStatement): VisitorResult<Value>;
    protected shouldStrictlySerialize(): boolean;
    protected visitRangeFor(indexSymbols: ts.Symbol[], rangeExpr: ts.NodeArray<ts.Expression>, body: ts.Statement, shouldUnroll: boolean): VisitorResult<Value>;
    protected visitNdrangeFor(indexSymbols: ts.Symbol[], rangeExpr: ts.NodeArray<ts.Expression>, body: ts.Statement, shouldUnroll: boolean): VisitorResult<Value>;
    protected isAtTopLevel(): boolean;
    protected isInVertexFor(): boolean;
    protected isInFragmentFor(): boolean;
    protected isInVertexOrFragmentFor(): boolean;
    protected isFragmentFor(node: ts.Node): boolean;
    protected visitVertexFor(indexSymbols: ts.Symbol[], vertexArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value>;
    protected visitFragmentFor(indexSymbols: ts.Symbol[], fragmentArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value>;
    protected visitForOfStatement(node: ts.ForOfStatement): VisitorResult<Value>;
    protected visitForInStatement(node: ts.ForInStatement): VisitorResult<Value>;
    protected visitForStatement(node: ts.ForStatement): VisitorResult<Value>;
    protected visitFunctionDeclaration(node: ts.FunctionDeclaration): VisitorResult<Value>;
    protected visitArrowFunction(node: ts.ArrowFunction): VisitorResult<Value>;
    protected visitThisKeyword(): VisitorResult<Value>;
    protected visitTrueKeyword(): VisitorResult<Value>;
    protected visitFalseKeyword(): VisitorResult<Value>;
    protected visitNonNullExpression(node: ts.NonNullExpression): VisitorResult<Value>;
    protected visitAsExpression(node: ts.AsExpression): VisitorResult<Value>;
    protected visitUnknown(node: ts.Node): VisitorResult<Value>;
}
export declare class InliningCompiler extends CompilingVisitor {
    funcName: string;
    constructor(irBuilder: IRBuilder, builtinOps: Map<string, BuiltinOp>, atomicOps: Map<string, BuiltinAtomicOp>, funcName: string);
    argValues: Value[];
    runInlining(parsedFunction: ParsedFunction, kernelScope: Scope, argValues: Value[], parentFunctionSymbolTable?: SymbolTable | null): Value | null;
    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>): void;
    protected visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value>;
    protected visitVertexFor(indexSymbols: ts.Symbol[], vertexArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value>;
    protected visitFragmentFor(indexSymbols: ts.Symbol[], fragmentArgs: ts.NodeArray<ts.Expression>, body: ts.Statement): VisitorResult<Value>;
    protected shouldStrictlySerialize(): boolean;
}
export declare class KernelCompiler extends CompilingVisitor {
    constructor();
    kernelArgTypes: Type[];
    argTypesMap: Map<string, Type>;
    templateArgumentValues: Map<string, any> | null;
    compileKernel(parsedFunction: ParsedFunction, scope: Scope, argTypesMap: Map<string, Type>, templateArgumentValues?: Map<string, any> | null): KernelParams;
    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>): void;
    protected visitReturnStatement(node: ts.ReturnStatement): VisitorResult<Value>;
    protected checkGraphicsShaderBindings(bindings: ResourceBinding[]): void;
}
export {};
