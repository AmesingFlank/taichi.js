import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor, VisitorResult} from "./ast/Visiter"
import { CompiledKernel } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import {error, assert} from '../utils/Logging'

export class CompilerContext {
    private host: InMemoryHost
    constructor(){
        this.host = new InMemoryHost()
    }

    public createProgramFromSource(source: string, options: ts.CompilerOptions) {
        let tempFileName = "temp.js"
        this.host.writeFile(tempFileName,source)
        return ts.createProgram([tempFileName], options, this.host);
    }
}

export class Compiler extends ASTVisitor<NativeTaichiAny>{
    constructor(){
        super()
        this.context = new CompilerContext()
        this.symbolStmtMap = new Map<ts.Symbol,NativeTaichiAny>()
    }
    private context: CompilerContext
    private program?: ts.Program
    private typeChecker? : ts.TypeChecker

    private symbolStmtMap : Map<ts.Symbol, NativeTaichiAny>;

    private nativeTaichi: NativeTaichiAny
    private irBuilder : NativeTaichiAny

    public async compileKernel(code:string) {
        this.irBuilder  = new nativeTaichi.IRBuilder()
        this.program = this.context.createProgramFromSource(code,{})
        this.typeChecker = this.program.getTypeChecker()
        
        let sourceFiles = this.program!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file")
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement")
        let kernelFunction = statements[0]
        assert(kernelFunction.kind === ts.SyntaxKind.FunctionDeclaration, "Expecting a function declaration")
        this.visitEachChild(kernelFunction)
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<NativeTaichiAny> {
        let left = this.extractResult(this.dispatchVisit(node.left))
        let right = this.extractResult(this.dispatchVisit(node.right))
        let op = node.operatorToken
        switch(op.kind){
            case (ts.SyntaxKind.EqualsToken): {
                this.irBuilder.create_global_ptr_global_store(left,right);
                return right
            }
            default:
                error("Unrecognized binary operator")
        }
    }
    
    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<NativeTaichiAny> {
        assert(node.initializer.kind === ts.SyntaxKind.VariableDeclarationList, "Expecting variable declaration list")
        let declarationList = node.initializer as ts.VariableDeclarationList
        assert(declarationList.declarations.length === 1, "Expecting exactly a single delcaration")
        let loopIndex = declarationList.declarations[0]
        let loopIndexSymbol = this.typeChecker!.getTypeAtLocation(loopIndex).getSymbol()!

        assert(node.expression.kind === ts.SyntaxKind.CallExpression, "Expecting a range() call")
        let callExpr = node.expression as ts.CallExpression
        let callExprType = this.typeChecker!.getTypeAtLocation(callExpr)
        let callExprSymbol = callExprType.getSymbol()
        let calledFuntionName = callExprSymbol!.name
        assert(calledFuntionName === "range", "Expecting a range() call")

        assert(callExpr.arguments.length === 1, "Expecting exactly 1 argument in range()")
        let rangeLengthExpr = callExpr.arguments[0]
        assert(rangeLengthExpr.kind === ts.SyntaxKind.NumericLiteral)
        let rangeLengthLiteral = rangeLengthExpr as ts.NumericLiteral

        let rangeLength = Number(rangeLengthLiteral.text)

        assert(Number.isInteger(rangeLength), "range length must be an integer")

        let zero = this.irBuilder.get_int32(0)    
        let nStmt = this.irBuilder.get_int32(rangeLength)
    
        let loop = this.irBuilder.create_range_for(zero, nStmt, 1, 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let indexStmt = this.irBuilder.get_loop_index(loop,0);
        
        this.symbolStmtMap.set(loopIndexSymbol, indexStmt)

        this.dispatchVisit(node.statement)

        loopGuard.delete()
    }
}