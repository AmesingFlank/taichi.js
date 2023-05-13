import type {
    CompilerHost as tsCompilerHost,
    CompilerOptions as tsCompilerOptions,
    ScriptTarget as tsScriptTarget,
    SourceFile as tsSourceFile,
} from 'typescript'
import { log } from '../../utils/Logging'
import * as ts from 'typescript'
import { VirtualFileSystem } from '../../utils/VirtualFileSystem'

// reference: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API#customizing-module-resolution

/**
 * Implementation of CompilerHost that works with in-memory-only source files
 */
export class InMemoryHost implements tsCompilerHost {
    constructor() {
        this.fs = new VirtualFileSystem()
    }

    private fs: VirtualFileSystem

    public getSourceFile(
        fileName: string,
        languageVersion: tsScriptTarget,
        onError?: (message: string) => void
    ): tsSourceFile | undefined {
        // log("getSourceFile ", fileName)
        let fileContent: string | null = null
        if (this.fs.fileExists(fileName)) {
            fileContent = this.fs.readFile(fileName)
        }
        if (fileContent != null) {
            return ts.createSourceFile(fileName, this.fs.readFile(fileName), languageVersion)
        }
    }

    public getDefaultLibFileName(options: tsCompilerOptions): string {
        return 'typescript.js'
    }

    public writeFile(path: string, content: string) {
        this.fs.writeFile(path, content, true)
    }

    public getCurrentDirectory(): string {
        const ret = '.'
        return ret
    }

    public getDirectories(path: string): string[] {
        throw new Error('Method not implemented.')
    }

    public getCanonicalFileName(fileName: string): string {
        return fileName
    }

    public useCaseSensitiveFileNames(): boolean {
        return true
    }
    public getNewLine(): string {
        return '\n'
    }

    // public resolveModuleNames?(moduleNames: string[], containingFile: string): ts.ResolvedModule[] {
    // 	log(`resolveModuleNames(${moduleNames})`);
    // 	return moduleNames.map(moduleName => {
    // 		{ // try to use standard resolution
    // 			const result = ts.resolveModuleName(
    // 				moduleName, containingFile,
    // 				this.options,
    // 				{
    // 					fileExists: this.fileExists.bind(this),
    // 					readFile: this.readFile.bind(this),
    // 				},
    // 			);
    // 			if (result.resolvedModule) return result.resolvedModule;
    // 		}

    // 		try { // fall back to NodeJS resolution
    // 			const fileName = require.resolve(moduleName);
    // 			if (fileName === moduleName) return; // internal module
    // 			log(`resolved ${moduleName} => ${fileName}`);
    // 			return {
    // 				resolvedFileName: fileName,
    // 			} as ts.ResolvedModule;
    // 		} catch (e) {
    // 			/* Not found */
    // 		}
    // 	});
    // }

    public fileExists(fileName: string): boolean {
        log(`fileExists(${fileName})`)
        return this.fs.fileExists(fileName)
    }
    public readFile(fileName: string): string {
        log(`readFile(${fileName})`)
        return this.fs.readFile(fileName)
    }
}
