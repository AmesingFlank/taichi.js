declare enum StmtKind {
    ConstStmt = "ConstStmt",
    RangeForStmt = "RangeForStmt",
    LoopIndexStmt = "LoopIndexStmt",
    AllocaStmt = "AllocaStmt",
    LocalLoadStmt = "LocalLoadStmt",
    GlobalPtrStmt = "GlobalPtrStmt",
    GlobalLoadStmt = "GlobalLoadStmt",
    BinaryOpStmt = "BinaryOpStmt",
    UnaryOpStmt = "UnaryOpStmt",
    WhileStmt = "WhileStmt",
    IfStmt = "IfStmt",
    WhileControlStmt = "WhileControlStmt",
    ContinueStmt = "ContinueStmt",
    ArgLoadStmt = "ArgLoadStmt",
    RandStmt = "RandStmt",
    ReturnStmt = "ReturnStmt",
    FuncCallStmt = "FuncCallStmt",
    AtomicOpStmt = "AtomicOpStmt"
}
declare function getStmtKind(stmt: any): StmtKind | undefined;
export { StmtKind, getStmtKind };
