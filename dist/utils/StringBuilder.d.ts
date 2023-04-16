export declare class StringBuilder {
    parts: string[];
    write(...args: (string | number)[]): void;
    getString(): string;
    empty(): boolean;
}
