import * as ts from "typescript";
import { InMemoryHost } from "./InMemoryHost";
import {ASTVisitor} from "./ast/Visiter"
import { CompiledKernel } from "../backend/Kernel";
import {getTaichiModule} from '../taichi_emscriptened/getTaichi' 


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

export class Compiler extends ASTVisitor<void>{
    constructor(){
        super()
        this.context = new CompilerContext()
    }
    private context: CompilerContext
    private program?: ts.Program
    private typeChecker? : ts.TypeChecker

    public compileKernel(code:string) {
        this.program = this.context.createProgramFromSource(code,{})
        this.typeChecker = this.program.getTypeChecker()
        
        let sourceFiles = this.program!.getSourceFiles()
        let sourceFile = sourceFiles[0]
        let statements = sourceFile.statements
        let kernelFunction = statements[0]
        this.visitEachChild(kernelFunction)
    }
}