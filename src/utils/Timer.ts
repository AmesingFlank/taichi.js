export class Timer {
    constructor() {

    }
    private begin: number = Date.now()
    time() {
        return Date.now() - this.begin
    }

    private static defaultTimer = new Timer()
    public static getDefaultTimer() {
        return this.defaultTimer
    }
}