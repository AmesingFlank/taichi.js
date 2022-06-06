interface Options {
    exclude?: (filename: string) => boolean;
}
export default function taichi(options?: Options): {
    name: string;
    buildStart(): void;
    renderChunk(code: string, chunk: any): {
        code: string;
    };
    transform(code: string, filename: string): {
        code: string;
    };
    warn(msg: string): void;
};
export {};
