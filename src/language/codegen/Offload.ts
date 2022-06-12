import { Guard } from "../ir/Builder";
import { IRModule, Stmt } from "../ir/Stmt";
import { IRTransformer } from "../ir/Transformer";
import { IRVisitor } from "../ir/Visitor";


export enum OffloadType {
    SerialCompute,
    Compute,
    Vertex,
    Fragment
}

export class OffloadedModule{
    constructor(
        public type: OffloadType,
        public module:IRModule,
        range?:number
    ){

    }
}

// export class OffloadingPass extends IRVisitor{
//     offloadedModules: OffloadedModule[] = []
//     currentOffloadType:OffloadType = OffloadType.SerialCompute
    
//     override pushNewStmt(stmt: Stmt): Stmt {
//         if(this.offloadedModules.length === 0 || this.offloadedModules.at(-1)!.type!== this.currentOffloadType){
//             this.offloadedModules.push(new OffloadedModule(this.currentOffloadType))
//         }

//     }

//     run(module:IRModule){
//         if(this.offloadedModules.length === 0){
//             this.offloadedModules.push(new OffloadedModule)
//         }
//     }

// }