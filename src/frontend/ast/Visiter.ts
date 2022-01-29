import * as ts from "typescript";
import {assert} from "../../utils/Logging"

type VisitorResult<T> = T | void | undefined

class ASTVisitor<T> {
    protected extractResult(result: VisitorResult<T>): T {
        assert(result !== undefined, "Result is undefined")
        return result as T
    }
    protected dispatchVisit(node: ts.Node): VisitorResult<T> {
        switch(node.kind){
            case ts.SyntaxKind.VariableDeclaration:
                return this.visitVariableDeclaration(node as ts.VariableDeclaration)
            case ts.SyntaxKind.VariableDeclarationList:
                return this.visitVariableDeclarationList(node as ts.VariableDeclarationList)
            case ts.SyntaxKind.FunctionDeclaration:
                return this.visitFunctionDeclaration(node as ts.FunctionDeclaration)
            case ts.SyntaxKind.ArrowFunction:
                return this.visitArrowFunction(node as ts.ArrowFunction)
            case ts.SyntaxKind.VariableStatement:
                return this.visitVariableStatement(node as ts.VariableStatement)
            case ts.SyntaxKind.Identifier:
                return this.visitIdentifier(node as ts.Identifier)
            case ts.SyntaxKind.ForOfStatement:
                return this.visitForOfStatement(node as ts.ForOfStatement)
            case ts.SyntaxKind.Block:
                return this.visitBlock(node as ts.Block)
            case ts.SyntaxKind.ExpressionStatement:
                return this.visitExpressionStatement(node as ts.ExpressionStatement)
            case ts.SyntaxKind.BinaryExpression:
                return this.visitBinaryExpression(node as ts.BinaryExpression)
            case ts.SyntaxKind.CallExpression:
                return this.visitCallExpression(node as ts.CallExpression)
            case ts.SyntaxKind.ElementAccessExpression:
                return this.visitElementAccessExpression(node as ts.ElementAccessExpression)
            default:
                return this.visitUnknown(node)
        }
    }

    protected visitEachChild(node:ts.Node, combiner: ((results:VisitorResult<T>[]) => VisitorResult<T>) | null = null): VisitorResult<T> {
        let results: VisitorResult<T>[] = []
        node.forEachChild((node)=>{
            let thisResult = this.dispatchVisit(node)
            results.push(thisResult)
        })
        if(combiner){
            return combiner(results)
        }
    }

    protected visitUnknown(node: ts.Node) : VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitIdentifier(node: ts.Node) : VisitorResult<T> {
        return this.visitIdentifier(node)
    }

    protected visitVariableDeclaration(node: ts.VariableDeclaration): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitVariableStatement(node: ts.VariableStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitFunctionDeclaration(node: ts.FunctionDeclaration): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitArrowFunction(node: ts.ArrowFunction): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitVariableDeclarationList(node: ts.VariableDeclarationList): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitForOfStatement(node: ts.ForOfStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitBlock(node: ts.Block): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitExpressionStatement(node: ts.ExpressionStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitCallExpression(node: ts.CallExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }
}


export {ASTVisitor,VisitorResult}