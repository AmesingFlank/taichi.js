import * as ts from 'typescript';
export declare class ParsedFunction {
    static makeFromCode(code: string): ParsedFunction;
    static makeFromParsedNode(node: ts.ArrowFunction | ts.FunctionDeclaration, parentFunction: ParsedFunction): ParsedFunction;
    typeChecker: ts.TypeChecker | null;
    tsProgram: ts.Program | null;
    functionNode: ts.Node | null;
    parent: ParsedFunction | null;
    argNames: string[];
    argNodes: ts.ParameterDeclaration[];
    protected registerFunctionNode(node: ts.Node): void;
    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>): void;
    hasNodeSymbol(node: ts.Node): boolean;
    getNodeSymbol(node: ts.Node): ts.Symbol;
    getSourceCodeAt(startPos: number, endPos: number): string;
    errorTsDiagnostics(diags: readonly ts.DiagnosticWithLocation[]): void;
    getNodeSourceCode(node: ts.Node): string;
    errorNode(node: ts.Node, ...args: any[]): void;
    assertNode(node: ts.Node, condition: boolean, ...args: any[]): void;
}
