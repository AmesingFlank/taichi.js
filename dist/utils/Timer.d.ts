export declare class Timer {
    constructor();
    private begin;
    time(): number;
    private static defaultTimer;
    static getDefaultTimer(): Timer;
}
