import {log} from "./Logging"

interface File {
	content: string;
	version: number;
}

export class VirtualFileSystem {

	/**
	 * Writes a file in the virtual FS
	 * @param filename The path this file should be stored as
	 * @param content The contents of the file
	 * @param overwrite If existing files should be overwritten
	 */
	public writeFile(filename: string, content: string, overwrite: boolean = false): void {
		log("vfs", `writeFile(filename: "${filename}", content: length ${content ? content.length : 0}, overwrite: ${overwrite}`, "debug");

		const exists = this.fileExists(filename, true);
		if (!overwrite && exists) {
			throw new Error(`The file ${filename} already exists. Set overwrite to true if you want to override it`);
		}

		if (!exists) {
			log("vfs", "  creating new file with version 1", "debug");
			this.files[filename] = {
				version: 1,
				content,
			};
		} else if (this.files[filename].content !== content) {
			this.files[filename] = {
				version: this.files[filename].version + 1,
				content,
			};
			log("vfs", `  updating file => version ${this.files[filename].version}`, "debug");
		}
	}

	/**
	 * Checks if a file exists in the virtual FS
	 * @param filename The path of the file to look for
	 */
	public fileExists(filename: string, suppressLog: boolean = false): boolean {
		const ret = filename in this.files;
		if (!suppressLog) log("vfs", `fileExists("${filename}") => ${ret}`, "debug");
		return ret;
	}

	/**
	 * Deletes a file in the virtual FS. If the file doesn't exist, nothing happens.
	 * @param filename The path of the file to look for
	 */
	public deleteFile(filename: string): void {
		log("vfs", `deleteFile("${filename}")`, "debug");
		if (this.fileExists(filename, true)) delete this.files[filename];
	}

	/**
	 * Reads a file's contents from the virtual FS
	 * @param filename The path of the file to look for
	 */
	public readFile(filename: string): string {
		if (!this.fileExists(filename, true)) {
			throw new Error(`The file ${filename} doesn't exist`);
		}

		const ret = this.files[filename].content;
		log("vfs", `readFile("${filename}") => length ${ret ? ret.length : 0}`, "debug");
		return ret;
	}

	/**
	 * Returns the revision number of a file in the virtual FS
	 * @param filename The path of the file to look for
	 */
	public getFileVersion(filename: string): number {
		if (!this.fileExists(filename, true)) {
			throw new Error(`The file ${filename} doesn't exist`);
		}
		const ret = this.files[filename].version;
		log("vfs", `getFileVersion("${filename}") => ${ret}`, "debug");
		return ret;
	}

	/**
	 * Returns the file names of all files in the virtual fs
	 */
	public getFilenames(): string[] {
		log("vfs", `getFilenames()`, "debug");
		return Object.keys(this.files);
	}

	public getDirectories(root: string): string[] {
		log("vfs", `fs.getDirectories(${root})`, "debug");
		let paths = this.getFilenames();
		log("vfs", `fs.getDirectories => paths = ${paths}`, "debug");
		paths = paths.filter(p => p.startsWith(root));
		log("vfs", `fs.getDirectories => paths = ${paths}`, "debug");
		paths = paths.map(p => p.substr(root.length + 1).split("/")[0]);
		log("vfs", `fs.getDirectories => paths = ${paths}`, "debug");
		return paths;
	}

	private files: {[filename: string]: File} = {};

}