import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import { ASTVisitor, VisitorResult } from "./ast/Visiter"
import { CompiledKernel, TaskParams, ResourceBinding, ResourceType, KernelParams, RenderPipelineParams, VertexShaderParams, FragmentShaderParams, RenderPassParams } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny } from '../native/taichi/GetTaichi'
import { error, assert } from '../utils/Logging'
import { Scope } from "../program/Scope";
import { CanvasTexture, Field, Texture, TextureBase } from "../program/Field";
import { Program } from "../program/Program";
import { getStmtKind, StmtKind } from "./Stmt"
import { getWgslShaderBindings, getWgslShaderStage, WgslShaderStage } from "./WgslReflection"
import { LibraryFunc } from "./Library";
import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, TypeUtils, PrimitiveType, toNativePrimitiveType, TypeError } from "./Type"
import { Value, ValueUtils } from "./Value"
import { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory } from "./BuiltinOp";
import { ResultOrError } from "./Error";


export class ParsedFunction {
    constructor(code: string) {
        let host: InMemoryHost = new InMemoryHost()
        let tempFileName = "temp.js"
        host.writeFile(tempFileName, code)
        let tsOptions: ts.CompilerOptions = {
            allowNonTsExtensions: true,
            target: ts.ScriptTarget.Latest,
            allowJs: true,
            strict: false,
            noImplicitUseStrict: true,
            alwaysStrict: false,
            strictFunctionTypes: false,
            checkJs: true
        };
        this.tsProgram = ts.createProgram([tempFileName], tsOptions, host);
        this.errorTsDiagnostics(this.tsProgram.getSyntacticDiagnostics())
        this.typeChecker = this.tsProgram.getTypeChecker()

        let sourceFiles = this.tsProgram!.getSourceFiles()
        this.assertNode(sourceFiles[0], sourceFiles.length === 1, "Expecting exactly 1 source file, got ", sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        this.assertNode(sourceFiles[0], statements.length === 1, "Expecting exactly 1 statement in ti.kernel (A single function or arrow function)")
        if (statements[0].kind === ts.SyntaxKind.FunctionDeclaration) {
            let func = statements[0] as ts.FunctionDeclaration
            this.registerArguments(func.parameters)
        }
        else if (statements[0].kind === ts.SyntaxKind.ExpressionStatement &&
            (statements[0] as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction) {
            let func = (statements[0] as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.registerArguments(func.parameters)
        }
        else {
            this.errorNode(sourceFiles[0], "Expecting a function or an arrow function in ti.kernel")
        }
    }

    typeChecker: ts.TypeChecker
    tsProgram: ts.Program
    argNames: string[] = []
    argNodes: ts.ParameterDeclaration[] = []

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        for (let a of args) {
            this.argNames.push(a.name.getText())
            this.argNodes.push(a)
        }
    }

    hasNodeSymbol(node: ts.Node): boolean {
        return this.typeChecker.getSymbolAtLocation(node) !== undefined
    }

    getNodeSymbol(node: ts.Node): ts.Symbol {
        let symbol = this.typeChecker.getSymbolAtLocation(node)
        if (symbol === undefined) {
            this.errorNode(node, "symbol not found for " + node.getText())
        }
        return symbol!
    }

    getSourceCodeAt(startPos: number, endPos: number): string {
        let sourceFile = this.tsProgram!.getSourceFiles()[0]
        let startLine = sourceFile.getLineAndCharacterOfPosition(startPos).line
        let endLine = sourceFile.getLineAndCharacterOfPosition(endPos).line

        let start = sourceFile.getLineStarts()[startLine]
        let end = sourceFile.getLineStarts()[endLine + 1]
        let code = sourceFile.getText().slice(start, end)
        return code
    }

    errorTsDiagnostics(diags: readonly ts.DiagnosticWithLocation[]) {
        let message = ""
        for (let diag of diags) {
            if (diag.category === ts.DiagnosticCategory.Error) {
                let startPos = diag.start
                let endPos = diag.start + diag.length
                let code = this.getSourceCodeAt(startPos, endPos)
                message += `
                Syntax Error: ${diag.messageText}   
                at:  
                ${code}
                `
            }
        }
        if (message !== "") {
            error("Kernel/function code cannot be parsed as Javascript: \n" + message)
        }
    }

    getNodeSourceCode(node: ts.Node): string {
        let startPos = node.getStart()
        let endPos = node.getEnd()
        let code = this.getSourceCodeAt(startPos, endPos)
        return code
    }

    errorNode(node: ts.Node, ...args: any[]) {
        let code = this.getNodeSourceCode(node)
        let errorMessage = "Error: "
        for (let a of args) {
            errorMessage += String(a)
        }
        errorMessage += `\nat:\n ${code} `
        error(errorMessage)
    }

    assertNode(node: ts.Node, condition: boolean, ...args: any[]) {
        if (!condition) {
            this.errorNode(node, ...args)
        }
    }
}
 