export declare class VirtualFileSystem {
    /**
     * Writes a file in the virtual FS
     * @param filename The path this file should be stored as
     * @param content The contents of the file
     * @param overwrite If existing files should be overwritten
     */
    writeFile(filename: string, content: string, overwrite?: boolean): void;
    /**
     * Checks if a file exists in the virtual FS
     * @param filename The path of the file to look for
     */
    fileExists(filename: string, suppressLog?: boolean): boolean;
    /**
     * Deletes a file in the virtual FS. If the file doesn't exist, nothing happens.
     * @param filename The path of the file to look for
     */
    deleteFile(filename: string): void;
    /**
     * Reads a file's contents from the virtual FS
     * @param filename The path of the file to look for
     */
    readFile(filename: string): string;
    /**
     * Returns the revision number of a file in the virtual FS
     * @param filename The path of the file to look for
     */
    getFileVersion(filename: string): number;
    /**
     * Returns the file names of all files in the virtual fs
     */
    getFilenames(): string[];
    getDirectories(root: string): string[];
    private files;
}
