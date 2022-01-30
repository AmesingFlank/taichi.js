
export function log(...args: any[]) {
    console.log(args)
}

export function error(...args: any[]) {
    console.error("FATAL ERROR: ",...args)
    throw "Taichi JS ERROR " 
}

export function assert(val: boolean, ...args:any[]) {
    if(!val){
        error(args)
    }
}