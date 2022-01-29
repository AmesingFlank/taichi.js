import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor, VisitorResult} from "./ast/Visiter"
import { CompiledKernel } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import { nativeTint} from '../native/tint/GetTint' 
import {error, assert} from '../utils/Logging'
import { GlobalScope } from "../program/GlobalScope";
import { Field } from "../program/Field";
import { Program } from "../program/Program";

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

export class OneTimeCompiler extends ASTVisitor<NativeTaichiAny>{
    constructor(private scope: GlobalScope){
        super()
        this.context = new CompilerContext()
        this.symbolStmtMap = new Map<ts.Symbol,NativeTaichiAny>()
    }
    private context: CompilerContext
    private tsProgram?: ts.Program
    private typeChecker? : ts.TypeChecker

    private symbolStmtMap : Map<ts.Symbol, NativeTaichiAny>;

    private nativeTaichi: NativeTaichiAny
    private irBuilder : NativeTaichiAny
    public kernelName:string|null = null

    compileKernel(code:string) : string[] {
        this.irBuilder  = new nativeTaichi.IRBuilder()
        this.tsProgram = this.context.createProgramFromSource(code,{})
        this.typeChecker = this.tsProgram.getTypeChecker()
        
        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file")
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement")
        assert(statements[0].kind === ts.SyntaxKind.FunctionDeclaration, "Expecting a function declaration")

        let kernelFunction = statements[0] as ts.FunctionDeclaration
        this.kernelName = kernelFunction.name!.text
        this.visitEachChild(kernelFunction)

        let kernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram,this.irBuilder , this.kernelName, false)
        Program.getCurrentProgram().nativeAotBuilder.add(this.kernelName, kernel);

        let tasks = nativeTaichi.get_kernel_spirv(Program.getCurrentProgram().nativeAotBuilder,this.kernelName);
        let result:string[] = []
        let numTasks = tasks.size()
        for(let i = 0; i < numTasks; ++ i){
            let task = tasks.get(i)
            let numWords = task.size()
            let spv:number[] = []
            for(let j = 0 ; j < numWords; ++ j){
                spv.push(tasks.get(i))
            }
            let wgsl = nativeTint.tintSpvToWgsl(spv)
            result.push(wgsl)
        }
        return result
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

    protected visitElementAccessExpression(node: ts.ElementAccessExpression): VisitorResult<NativeTaichiAny> {
        let base = node.expression
        let argument = node.argumentExpression
        if(base.kind === ts.SyntaxKind.Identifier){
            let baseName = base.getText()
            if(this.scope.hasStored(baseName)){
                if(!(this.scope.getStored(baseName) instanceof Field)){
                    error("only supports indexing a field")
                }
                let field = this.scope.getStored(baseName) as Field
                //field.addToAotBuilder(Program.getCurrentProgram().nativeAotBuilder, baseName)

                let place = field.placeNode
                let argumentStmt = this.extractResult(this.dispatchVisit(argument))

                let accessVec : NativeTaichiAny = new nativeTaichi.VectorOfStmtPtr()
                accessVec.push_back(argumentStmt)
          
                let ptr = this.irBuilder.create_global_ptr(place,accessVec);
                return ptr
            }
            else{
                error("Variable not found in global scope: ", baseName)
            }
        }
        else{
            error("matrices and vectors not supported yet")
        }
        
    }

    protected override visitIdentifier(node: ts.Identifier): VisitorResult<NativeTaichiAny> {
        let symbol = this.typeChecker!.getSymbolAtLocation(node)!
        if(!this.symbolStmtMap.has(symbol)){
            error("Symbol not found: ",node,node.text)
        }
        return this.symbolStmtMap.get(symbol)
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