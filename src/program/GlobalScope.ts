 

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

    getProxy(){
        let handler = {}
        return new Proxy(this,handler)
    }
}

export {GlobalScope}