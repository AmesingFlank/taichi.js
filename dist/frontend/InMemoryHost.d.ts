import type { CompilerHost as tsCompilerHost, CompilerOptions as tsCompilerOptions, ScriptTarget as tsScriptTarget, SourceFile as tsSourceFile } from "typescript";
/**
 * Implementation of CompilerHost that works with in-memory-only source files
 */
export declare class InMemoryHost implements tsCompilerHost {
    constructor();
    private fs;
    getSourceFile(fileName: string, languageVersion: tsScriptTarget, onError?: (message: string) => void): tsSourceFile | undefined;
    getDefaultLibFileName(options: tsCompilerOptions): string;
    writeFile(path: string, content: string): void;
    getCurrentDirectory(): string;
    getDirectories(path: string): string[];
    getCanonicalFileName(fileName: string): string;
    useCaseSensitiveFileNames(): boolean;
    getNewLine(): string;
    fileExists(fileName: string): boolean;
    readFile(fileName: string): string;
}
