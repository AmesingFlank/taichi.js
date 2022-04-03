import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import { error } from '../utils/Logging'


// A parsed JS function.
// The optional argument `parent` is a parent JS function whose scope this function resides in
export class ParsedFunction {

    static makeFromCode(code: string): ParsedFunction {
        let parsedFunction = new ParsedFunction()
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
        parsedFunction.tsProgram = ts.createProgram([tempFileName], tsOptions, host);
        parsedFunction.errorTsDiagnostics(parsedFunction.tsProgram.getSyntacticDiagnostics())
        parsedFunction.typeChecker = parsedFunction.tsProgram.getTypeChecker()

        let sourceFiles = parsedFunction.tsProgram!.getSourceFiles()
        parsedFunction.assertNode(sourceFiles[0], sourceFiles.length === 1, "Expecting exactly 1 source file, got ", sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        parsedFunction.assertNode(sourceFiles[0], statements.length === 1, "Expecting exactly 1 statement in ti.kernel (A single function or arrow function)")
        parsedFunction.registerFunctionNode(statements[0])
        return parsedFunction
    }

    // used for functions embedded in another parsed function
    static makeFromParsedNode(node: ts.ArrowFunction | ts.FunctionDeclaration, parentFunction:ParsedFunction): ParsedFunction {
        let parsedFunction = new ParsedFunction()
        parentFunction.parent = parentFunction
        parsedFunction.typeChecker = parentFunction.typeChecker!
        parsedFunction.tsProgram = parentFunction.tsProgram!
        parsedFunction.registerFunctionNode(node)
        return parsedFunction
    }

    typeChecker: ts.TypeChecker | null = null
    tsProgram: ts.Program | null = null
    functionNode: ts.Node | null = null
    parent: ParsedFunction | null = null
    argNames: string[] = []
    argNodes: ts.ParameterDeclaration[] = []

    protected registerFunctionNode(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
            this.functionNode = node
            this.registerArguments((node as ts.FunctionDeclaration).parameters)
        }
        else if (node.kind === ts.SyntaxKind.ExpressionStatement &&
            (node as ts.ExpressionStatement).expression.kind === ts.SyntaxKind.ArrowFunction) {
            let func = (node as ts.ExpressionStatement).expression as ts.ArrowFunction
            this.functionNode = func
            this.registerArguments(func.parameters)
        }
        else if (node.kind === ts.SyntaxKind.ArrowFunction) {
            this.functionNode = node;
            this.registerArguments((node as ts.ArrowFunction).parameters)
        }
        else {
            this.errorNode(node, "Expecting a function or an arrow function in kernel/function")
        }
    }

    protected registerArguments(args: ts.NodeArray<ts.ParameterDeclaration>) {
        for (let a of args) {
            this.argNames.push(a.name.getText())
            this.argNodes.push(a)
        }
    }

    hasNodeSymbol(node: ts.Node): boolean {
        return this.typeChecker!.getSymbolAtLocation(node) !== undefined
    }

    getNodeSymbol(node: ts.Node): ts.Symbol {
        this.assertNode(node, this.hasNodeSymbol(node), "symbol not found for " + node.getText())
        return this.typeChecker!.getSymbolAtLocation(node)!
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
