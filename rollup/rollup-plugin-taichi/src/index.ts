import * as ts from "typescript"
import { readFile, writeFile } from 'fs/promises';

let warn = (msg: string) => { }

let substitutions: Map<ts.Node, ts.Node> = new Map<ts.Node, ts.Node>()

let transformerFactory = (context: ts.TransformationContext) => {
    const visit: ts.Visitor = node => {
        if (node.kind === ts.SyntaxKind.CallExpression) {
            let call = node as ts.CallExpression
            if (call.expression.getText() === "ti.kernel" || call.expression.getText() === "ti.func" || call.expression.getText() === "ti.classKernel") {
                let args = call.arguments;
                for (let i = 0; i < args.length; ++i) {
                    if (args[i].kind === ts.SyntaxKind.ArrowFunction || args[i].kind === ts.SyntaxKind.FunctionExpression) {
                        let argCode = args[i].getText()
                        let literal = ts.factory.createNoSubstitutionTemplateLiteral(argCode, argCode)
                        substitutions.set(args[i], literal)
                    }
                }
            }
        }
        if (substitutions.has(node)) {
            return substitutions.get(node)!
        }
        return ts.visitEachChild(node, child => visit(child), context);
    };

    return (node: ts.Node) => ts.visitNode(node, visit);
}

interface Options {
    exclude?: (filename: string) => boolean
}

function transformCode(code: string, filename: string, options?: Options) {
    if (options && options.exclude !== undefined && options.exclude(filename)) {
        return {
            code: code
        }
    }

    let src = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)
    src = ts.transform(src, [transformerFactory]).transformed[0] as ts.SourceFile
    let printer = ts.createPrinter(
        { removeComments: false }
    )
    let result = printer.printNode(ts.EmitHint.SourceFile, src, src)
    return {
        code: result
    }
}



export default function taichi(options?: Options) {
    return {
        name: 'taichi',

        buildStart() {
            warn = (msg: string) => { this.warn(msg) }
        },

        transform(code: string, filename: string) {
            let result = transformCode(code, filename, options);
            return result
        },

        warn(msg: string) {
            //@ts-ignore
            this.console.warn({ message: msg });
        }
    };
}