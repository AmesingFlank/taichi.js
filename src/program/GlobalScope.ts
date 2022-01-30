 

class GlobalScope {
    constructor(){

    }

    hasStored(name:string):boolean{
        return name in this;
    }

    getStored(name:string):any {
        //@ts-ignore
        return this[name];
    } 

    addStored(name:string, val:any) {
        //@ts-ignore
        this[name] = val
    }
}

export {GlobalScope}