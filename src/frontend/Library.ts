// using raw strings to avoid mimification problems..

let polar2dCode = 
`
(A, U, P) => {
    let x = A[0,0] + A[1,1]
    let y = A[1,0] - A[0,1]
    let scale = 1.0 / sqrt(x * x + y * y)
    let c = x * scale
    let s = y * scale
    let r = [[c, -s], [s, c]]
    U = r
    P = r.transpose().matmul(A) 
}
`

let svd2dCode = 
`
(A, U, E, V) => {
    let R = [[0.0, 0.0],[0.0, 0.0]]
    let S = [[0.0, 0.0],[0.0, 0.0]]
    ti.polar_decompose_2d(A, R, S)
    let c = 0.0
    let s = 0.0
    let s1 = 0.0
    let s2 = 0.0
    if (ti.abs(S[0,1]) < 1e-5){
        c = 1.0
        s = 0.0
        s1 = S[0,0]
        s2 = S[1,1]
    }
    else{
        let tao = 0.5 * (S[0,0] - S[1,1])
        let w = ti.sqrt(tao ** 2  + S[0,1] ** 2)
        let t = 0.0
        if (tao > 0){
            t = S[0,1] / (tao + w)
        }
        else{
            t = S[0,1] / (tao - w)
        }
        c = 1 / ti.sqrt (t**2 + 1)
        s = -t * c
        s1 = c**2 * S[0, 0] - 2 * c * s * S[0, 1] + s**2 * S[1, 1]
        s2 = s**2 * S[0, 0] + 2 * c * s * S[0, 1] + c**2 * S[1, 1]
    }
    if (s1 < s2){
        let tmp = s1
        s1 = s2
        s2 = tmp
        V = [[-s, c], [-c, -s]]
    }
    else{
        V = [[c, s], [-s, c]]
    }
    U = R.matmul(V)
    E = [[s1,0.0], [0.0,s2]]
}
`

class LibraryFunc {
    constructor(public name:string, public numArgs:number, public code:string){

    }

    public static getLibraryFuncs():Map<string,LibraryFunc>{
        let funcs:LibraryFunc[] = [
            new LibraryFunc("polar_decompose_2d", 3,polar2dCode),
            new LibraryFunc("svd_2d", 4, svd2dCode),
        ]

        let funcsMap = new Map<string,LibraryFunc>()
        for(let f of funcs){
            funcsMap.set(f.name,f)
        }
        return funcsMap
    }
}



export {LibraryFunc}