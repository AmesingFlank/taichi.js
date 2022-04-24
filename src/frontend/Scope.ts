

class Scope {
    constructor() {
    }

    obj: any = {}
    thisObj: any = {}

    hasStored(name: string): boolean {
        return name in this.obj;
    }

    getStored(name: string): any {
        return this.obj[name];
    }

    addStored(name: string, val: any) {
        this.obj[name] = val
    }

    clearStored() {
        this.obj = {}
        this.thisObj = {}
    }

    canEvaluate(str: string): boolean {
        return this.tryEvaluate(str) !== undefined
    }

    tryEvaluate(str: string): any {
        // magic.
        // https://stackoverflow.com/questions/9781285/specify-scope-for-eval-in-javascript
        let scopedEval = (context: any, expr: string): any => {
            const evaluator = Function.apply(this.thisObj, [...Object.keys(context), 'expr', "return eval('expr = undefined;' + expr)"]);
            return evaluator.apply(this.thisObj, [...Object.values(context), expr]);
        }
        try {
            return scopedEval(this.obj, str)
        }
        catch (e) {
            return undefined
        }
    }

    clone() {
        let newObj: any = {}
        for (let k in this.obj) {
            newObj[k] = this.obj[k]
        }
        let result = new Scope
        result.obj = newObj
        result.thisObj = this.thisObj
        return result
    }
}

export { Scope }