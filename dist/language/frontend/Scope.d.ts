declare class Scope {
    constructor();
    obj: any;
    thisObj: any;
    hasStored(name: string): boolean;
    getStored(name: string): any;
    addStored(name: string, val: any): void;
    clearStored(): void;
    canEvaluate(str: string): boolean;
    tryEvaluate(str: string): any;
    clone(): Scope;
}
export { Scope };
