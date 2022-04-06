declare class LibraryFunc {
    name: string;
    numArgs: number;
    code: string;
    constructor(name: string, numArgs: number, code: string);
    static getLibraryFuncs(): Map<string, LibraryFunc>;
}
export { LibraryFunc };
