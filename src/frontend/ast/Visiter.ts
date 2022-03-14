import * as ts from "typescript";
import { assert } from "../../utils/Logging"

type VisitorResult<T> = T | void | undefined

class ASTVisitor<T> {
    protected extractVisitorResult(result: VisitorResult<T>): T {
        assert(result !== undefined, "Result is undefined")
        return result as T
    }
    protected dispatchVisit(node: ts.Node): VisitorResult<T> {
        switch (node.kind) {
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
            case ts.SyntaxKind.ForStatement:
                return this.visitForOfStatement(node as ts.ForOfStatement)
            case ts.SyntaxKind.ForInStatement:
                return this.visitForInStatement(node as ts.ForInStatement)
            case ts.SyntaxKind.IfStatement:
                return this.visitIfStatement(node as ts.IfStatement)
            case ts.SyntaxKind.WhileStatement:
                return this.visitWhileStatement(node as ts.WhileStatement)
            case ts.SyntaxKind.BreakStatement:
                return this.visitBreakStatement(node as ts.BreakStatement)
            case ts.SyntaxKind.ContinueStatement:
                return this.visitContinueStatement(node as ts.ContinueStatement)
            case ts.SyntaxKind.ReturnStatement:
                return this.visitReturnStatement(node as ts.ReturnStatement)
            case ts.SyntaxKind.Block:
                return this.visitBlock(node as ts.Block)
            case ts.SyntaxKind.NumericLiteral:
                return this.visitNumericLiteral(node as ts.NumericLiteral)
            case ts.SyntaxKind.ExpressionStatement:
                return this.visitExpressionStatement(node as ts.ExpressionStatement)
            case ts.SyntaxKind.BinaryExpression:
                return this.visitBinaryExpression(node as ts.BinaryExpression)
            case ts.SyntaxKind.PrefixUnaryExpression:
                return this.visitPrefixUnaryExpression(node as ts.PrefixUnaryExpression)
            case ts.SyntaxKind.CallExpression:
                return this.visitCallExpression(node as ts.CallExpression)
            case ts.SyntaxKind.PropertyAccessExpression:
                return this.visitPropertyAccessExpression(node as ts.PropertyAccessExpression)
            case ts.SyntaxKind.ElementAccessExpression:
                return this.visitElementAccessExpression(node as ts.ElementAccessExpression)
            case ts.SyntaxKind.ParenthesizedExpression:
                return this.visitParenthesizedExpression(node as ts.ParenthesizedExpression)
            case ts.SyntaxKind.ArrayLiteralExpression:
                return this.visitArrayLiteralExpression(node as ts.ArrayLiteralExpression)
            case ts.SyntaxKind.ObjectLiteralExpression:
                return this.visitObjectLiteralExpression(node as ts.ObjectLiteralExpression)
            default:
                return this.visitUnknown(node)
        }
    }

    protected visitEachChild(node: ts.Node, combiner: ((results: VisitorResult<T>[]) => VisitorResult<T>) | null = null): VisitorResult<T> {
        let results: VisitorResult<T>[] = []
        node.forEachChild((node) => {
            let thisResult = this.dispatchVisit(node)
            results.push(thisResult)
        })
        if (combiner) {
            return combiner(results)
        }
    }

    protected visitUnknown(node: ts.Node): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitNumericLiteral(node: ts.NumericLiteral): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitIdentifier(node: ts.Node): VisitorResult<T> {
        return this.visitEachChild(node)
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

    protected visitForInStatement(node: ts.ForInStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitForStatement(node: ts.ForStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitIfStatement(node: ts.IfStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitWhileStatement(node: ts.WhileStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitBreakStatement(node: ts.BreakStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitContinueStatement(node: ts.ContinueStatement): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitReturnStatement(node: ts.ReturnStatement): VisitorResult<T> {
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

    protected visitPrefixUnaryExpression(node: ts.PrefixUnaryExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitCallExpression(node: ts.CallExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitPropertyAccessExpression(node: ts.PropertyAccessExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitParenthesizedExpression(node: ts.ParenthesizedExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitArrayLiteralExpression(node: ts.ArrayLiteralExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }

    protected visitObjectLiteralExpression(node: ts.ObjectLiteralExpression): VisitorResult<T> {
        return this.visitEachChild(node)
    }
}


export { ASTVisitor, VisitorResult }