import { VertexForStmt, FragmentForStmt, RangeForStmt, Stmt, AllocaStmt, LocalLoadStmt, LocalStoreStmt, AtomicOpStmt, GlobalTemporaryStmt, IRModule } from "../Stmt";
import { IRTransformer } from "../Transformer";
import { IRVisitor } from "../Visitor";
import { DelayedStmtReplacer } from "./Replacer";
export declare class AllocGtempsPass extends IRVisitor {
    inParallelLoop: boolean;
    serialAllocas: Set<Stmt>;
    maybeAllocateGtemp(alloca: AllocaStmt): void;
    gtempsAllocation: Map<Stmt, number>;
    constructor();
    visitRangeForStmt(stmt: RangeForStmt): void;
    visitVertexForStmt(stmt: VertexForStmt): void;
    visitFragmentForStmt(stmt: FragmentForStmt): void;
    visitAllocaStmt(stmt: AllocaStmt): void;
    visitLocalLoadStmt(stmt: LocalLoadStmt): void;
    visitLocalStoreStmt(stmt: LocalStoreStmt): void;
    visitAtomicOpStmt(stmt: AtomicOpStmt): void;
}
export declare class ReplaceGtempPass extends IRTransformer {
    gtempsAllocation: Map<Stmt, number>;
    replacer: DelayedStmtReplacer;
    constructor(gtempsAllocation: Map<Stmt, number>);
    maybeGetReplacementGtemp(stmt: AllocaStmt): GlobalTemporaryStmt | undefined;
    visitLocalLoadStmt(stmt: LocalLoadStmt): void;
    visitLocalStoreStmt(stmt: LocalStoreStmt): void;
    visitAtomicOpStmt(stmt: AtomicOpStmt): void;
    transform(module: IRModule): void;
}
export declare class LoopRangeGtempPass extends IRTransformer {
    nextGtempSlot: number;
    constructor(nextGtempSlot: number);
    visitRangeForStmt(stmt: RangeForStmt): void;
    visitVertexForStmt(stmt: RangeForStmt): void;
}
export declare function insertGlobalTemporaries(module: IRModule): void;
