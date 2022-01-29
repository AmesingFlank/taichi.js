 

class GlobalScope {
    constructor(){

    }

    getProxy(){
        let handler = {}
        return new Proxy(this,handler)
    }
}

export {GlobalScope}