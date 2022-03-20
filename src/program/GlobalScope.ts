 

class GlobalScope {
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
            if(!(name in curr)){
                return undefined
            }
            curr = curr[name]
        }
        return curr
    }
}

export {GlobalScope}