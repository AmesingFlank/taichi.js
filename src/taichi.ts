
function kernel(f:any){
    console.log(f.toString())
}

const taichi = {
    kernel
}

export {taichi}