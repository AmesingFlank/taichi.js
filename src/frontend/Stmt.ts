
import {error} from "../utils/Logging"

enum StmtKind{
    ConstStmt = "ConstStmt",
    RangeForStmt = "RangeForStmt",
    LoopIndexStmt = "LoopIndexStmt",
    AllocaStmt = "AllocaStmt",
    LocalLoadStmt = "LocalLoadStmt",
    GlobalPtrStmt = "GlobalPtrStmt",
    GlobalLoadStmt = "GlobalLoadStmt",
    BinaryOpStmt = "BinaryOpStmt",
    UnaryOpStmt = "UnaryOpStmt"
}

function getStmtKind (stmt:any): StmtKind | undefined {
    let name:string = stmt.constructor.name
    for(let kind in StmtKind){
        if(name === kind){
            return kind as StmtKind
        }
    }
    error("unrecognized stmt: ",stmt,name)
}

export {StmtKind, getStmtKind}