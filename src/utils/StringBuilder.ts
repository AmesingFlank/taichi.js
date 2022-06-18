export class StringBuilder {
    parts: string[] = []
    write(...args: (string | number)[]) {
        for (let a of args) {
            this.parts.push(a.toString())
        }
    }
    getString() {
        return this.parts.join("")
    }
    empty() {
        return this.parts.length === 0
    }
}