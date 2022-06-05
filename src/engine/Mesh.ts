export class MeshPrimitive {
    constructor(
        public firstIndex: number,
        public indexCount: number,
        public materialID: number,
    ) {

    }
}

export class Mesh {
    constructor(
        public primitives:MeshPrimitive[] = []
    ){
        
    }
}