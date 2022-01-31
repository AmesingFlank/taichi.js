import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor, VisitorResult} from "./ast/Visiter"
import { CompiledKernel, TaskParams } from "../backend/Kernel";
import { nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi' 
import { nativeTint} from '../native/tint/GetTint' 
import {error, assert} from '../utils/Logging'
import { GlobalScope } from "../program/GlobalScope";
import { Field } from "../program/Field";
import { Program } from "../program/Program";
import {getStmtKind, StmtKind} from "./Stmt"

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

export class OneTimeCompiler extends ASTVisitor<NativeTaichiAny>{ // It's actually a ASTVisitor<Stmt>, but we don't have the types yet
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

    compileKernel(code: any) : TaskParams[] {
        let codeString = code.toString()
        this.irBuilder  = new nativeTaichi.IRBuilder()

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

        this.tsProgram = this.context.createProgramFromSource(codeString,tsOptions)
        this.typeChecker = this.tsProgram.getTypeChecker()
        
        let sourceFiles = this.tsProgram!.getSourceFiles()
        assert(sourceFiles.length === 1, "Expecting exactly 1 source file, got ",sourceFiles.length)
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        assert(statements.length === 1, "Expecting exactly 1 statement")
        assert(statements[0].kind === ts.SyntaxKind.FunctionDeclaration, "Expecting a function declaration")

        let kernelFunction = statements[0] as ts.FunctionDeclaration
        this.kernelName = kernelFunction.name!.text
        this.visitEachChild(kernelFunction.body!)

        let kernel = nativeTaichi.Kernel.create_kernel(Program.getCurrentProgram().nativeProgram,this.irBuilder , this.kernelName, false)
        Program.getCurrentProgram().nativeAotBuilder.add(this.kernelName, kernel);

        let tasks = nativeTaichi.get_kernel_params(Program.getCurrentProgram().nativeAotBuilder,this.kernelName);
        let result:TaskParams[] = []
        let numTasks = tasks.size()
        for(let i = 0; i < numTasks; ++ i){
            let task = tasks.get(i)
            let spirvUint32Vec = task.get_spirv_ptr()
            let numWords = spirvUint32Vec.size()
            let spv:number[] = []
            for(let j = 0 ; j < numWords; ++ j){
                spv.push(spirvUint32Vec.get(j))
            }
            let wgsl = nativeTint.tintSpvToWgsl(spv)
            let rangeHint:string = task.get_range_hint()
            let invocations = Number(rangeHint)
            result.push({code:wgsl,invocations})
        }
        return result
    }

    private getStmtValue(stmt:NativeTaichiAny) : NativeTaichiAny{
        let kind = getStmtKind(stmt)
        switch(kind){
            case StmtKind.GlobalPtrStmt: {
                return this.irBuilder.create_global_ptr_global_load(stmt); 
            }
            default: {
                return stmt
            }
        }
    }

    protected override visitNumericLiteral(node: ts.NumericLiteral) : VisitorResult<NativeTaichiAny> {
        let value = Number(node.text)
        if(node.text.includes(".")){
            return this.irBuilder.get_float32(value)
        }
        else{
            return this.irBuilder.get_int32(value)
        }
    }

    protected override visitBinaryExpression(node: ts.BinaryExpression): VisitorResult<NativeTaichiAny> {
        let left = this.extractVisitorResult(this.dispatchVisit(node.left))
        let right = this.extractVisitorResult(this.dispatchVisit(node.right))
        let rightValue = this.getStmtValue(right)
        let op = node.operatorToken
        switch(op.kind){
            case (ts.SyntaxKind.EqualsToken): {
                this.irBuilder.create_global_ptr_global_store(left,rightValue);
                return right
            }
            case (ts.SyntaxKind.PlusToken): {
                let leftValue = this.getStmtValue(left)
                return this.irBuilder.create_add(leftValue,rightValue)
            }
            case (ts.SyntaxKind.MinusToken): {
                let leftValue = this.getStmtValue(left)
                return this.irBuilder.create_sub(leftValue,rightValue)
            }
            case (ts.SyntaxKind.AsteriskToken): {
                let leftValue = this.getStmtValue(left)
                return this.irBuilder.create_mul(leftValue,rightValue)
            }
            case (ts.SyntaxKind.SlashToken): {
                let leftValue = this.getStmtValue(left)
                return this.irBuilder.create_div(leftValue,rightValue)
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

                let place = field.placeNodes[0]
                let argumentStmt = this.getStmtValue(this.extractVisitorResult(this.dispatchVisit(argument)))

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
            error("Symbol not found: ",node,node.text,symbol)
        }
        return this.symbolStmtMap.get(symbol)
    }
    
    protected override visitForOfStatement(node: ts.ForOfStatement): VisitorResult<NativeTaichiAny> {
        assert(node.initializer.kind === ts.SyntaxKind.VariableDeclarationList, "Expecting variable declaration list, got",node.initializer.kind)
        let declarationList = node.initializer as ts.VariableDeclarationList
        assert(declarationList.declarations.length === 1, "Expecting exactly 1 delcaration")
        let loopIndexDecl = declarationList.declarations[0]
        assert(loopIndexDecl.name.kind === ts.SyntaxKind.Identifier, "Expecting identifier")
        let loopIndexIdentifer = loopIndexDecl.name as ts.Identifier
        let loopIndexSymbol = this.typeChecker!.getSymbolAtLocation(loopIndexIdentifer)! 

        assert(node.expression.kind === ts.SyntaxKind.CallExpression, "Expecting a range() call")
        let callExpr = node.expression as ts.CallExpression
        let calledFuntionExpr = callExpr.expression
        assert(calledFuntionExpr.kind === ts.SyntaxKind.Identifier, "Expecting a range() call")
        let calledFunctionName = (calledFuntionExpr as ts.Identifier).text
        assert(calledFunctionName === "range", "Expecting a range() call")

        assert(callExpr.arguments.length === 1, "Expecting exactly 1 argument in range()")
        let rangeLengthExpr = callExpr.arguments[0]
        assert(rangeLengthExpr.kind === ts.SyntaxKind.NumericLiteral)
        let rangeLengthLiteral = rangeLengthExpr as ts.NumericLiteral

        let rangeLength = Number(rangeLengthLiteral.text)

        assert(Number.isInteger(rangeLength), "range length must be an integer")

        let zero = this.irBuilder.get_int32(0)    
        let nStmt = this.irBuilder.get_int32(rangeLength)
    
        let loop = this.irBuilder.create_range_for(zero, nStmt, 0, 4, 0, false);

        let loopGuard = this.irBuilder.get_range_loop_guard(loop);
        let indexStmt = this.irBuilder.get_loop_index(loop,0);
        
        this.symbolStmtMap.set(loopIndexSymbol, indexStmt)

        this.dispatchVisit(node.statement)

        loopGuard.delete()
    }
}