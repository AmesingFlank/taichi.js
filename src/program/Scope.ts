 

class Scope {
    constructor(){
    }

    obj:any = {}

    hasStored(name:string):boolean{
        return name in this.obj;
    }

    getStored(name:string):any {
        return this.obj[name];
    } 

    addStored(name:string, val:any) {
        this.obj[name] = val
    }

    clearStored(){
        this.obj = {}
    }

    canEvaluate(str:string):boolean{
        return this.tryEvaluate(str) !== undefined
    }

    tryEvaluate(str:string): any {
        // magic.
        // https://stackoverflow.com/questions/9781285/specify-scope-for-eval-in-javascript
        let scopedEval = (context:any, expr:string):any  =>  {
            const evaluator = Function.apply(null, [...Object.keys(context), 'expr', "return eval('expr = undefined;' + expr)"]);
            return evaluator.apply(null, [...Object.values(context), expr]);
        }
        try{
            return scopedEval(this.obj, str)
        }
        catch(e){
            return undefined
        }
    }

    clone(){
        let newObj:any = {}
        for(let k in this.obj){
            newObj[k] = this.obj[k]
        }
        let result = new Scope
        result.obj = newObj
        return result
    }

    static merge(a:Scope, b:Scope) : Scope{
        let result = new Scope()
        for(let k in a.obj){
            result.obj[k] = a.obj[k]
        }
        for(let k in b.obj){
            result.obj[k] = b.obj[k]
        }
        return result
    }
}

export {Scope}