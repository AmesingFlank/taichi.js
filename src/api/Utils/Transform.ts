export class Transform {
    constructor(){
        this.reset()
    }
    reset(){
        this.matrix = 
        [
            [1,0,0,0],
            [0,1,0,0],
            [0,0,1,0],
            [0,0,0,1]
        ]
    }
    matrix: number[][] = []
    
}