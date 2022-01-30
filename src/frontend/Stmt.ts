
import {error} from "../utils/Logging"

enum StmtKind{
    ConstStmt = "ConstStmt",
    RangeForStmt = "RangeForStmt",
    LoopIndexStmt = "LoopIndexStmt",
    GlobalPtrStmt = "GlobalPtrStmt",
    BinaryOpStmt = "BinaryOpStmt",
    UnaryOpStmt = "UnaryOpStmt"
}

function getStmtKind (stmt:any):StmtKind {
    let name:string = stmt.constructor.name
    for(let kind in StmtKind){
        if(name === kind){
            return StmtKind[kind]
        }
    }
    error("unrecognized stmt: ",stmt,name)
}

export {StmtKind, getStmtKind}