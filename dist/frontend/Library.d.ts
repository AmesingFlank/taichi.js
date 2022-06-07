declare class LibraryFunc {
    name: string;
    code: string;
    constructor(name: string, code: string);
    static getLibraryFuncs(): Map<string, LibraryFunc>;
}
export { LibraryFunc };
