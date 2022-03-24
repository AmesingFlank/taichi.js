 

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
        let parts = str.split(".")
        let curr = this.obj
        for(let name of parts){
            if(typeof curr !== "object"){
                return undefined
            }
            if(!(name in curr)){
                return undefined
            }
            curr = curr[name]
        }
        return curr
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