import { WhileStmt, IfStmt, VertexForStmt, FragmentForStmt, RangeForStmt, Stmt, AllocaStmt, LocalLoadStmt, LocalStoreStmt, AtomicOpStmt, StmtKind } from "../Stmt"
import { IRTransformer } from "../Transformer"
import { IRVisitor } from "../Visitor"



export class AllocGtempsPass extends IRVisitor {
    inParallelLoop: boolean = false

    serialAllocas: Set<Stmt> = new Set<Stmt>()
    maybeAllocateGtemp(alloca: AllocaStmt) {
        if (this.inParallelLoop && this.serialAllocas.has(alloca) && !this.gtempsAllocation.has(alloca)) {
            let offset = this.gtempsAllocation.size
            this.gtempsAllocation.set(alloca, offset)
        }
    }

    constructor(public gtempsAllocation: Map<Stmt, number>) {
        super()
    }

    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitRangeForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitVertexForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitVertexForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitFragmentForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitFragmentForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitAllocaStmt(stmt: AllocaStmt): void {
        if (!this.inParallelLoop) {
            this.serialAllocas.add(stmt)
        }
    }
    override visitLocalLoadStmt(stmt: LocalLoadStmt): void {
        this.maybeAllocateGtemp(stmt.getPointer())
    }
    override visitLocalStoreStmt(stmt: LocalStoreStmt): void {
        this.maybeAllocateGtemp(stmt.getPointer())
    }
    override visitAtomicOpStmt(stmt: AtomicOpStmt): void {
        if (stmt.getDestination().getKind() === StmtKind.AllocaStmt) {
            this.maybeAllocateGtemp(stmt.getDestination() as AllocaStmt)
        }
    }
}

// export class LoopRangeGtempPass extends IRTransformer{
//     constructor(public gtempsAllocation: Map<Stmt, number>) {
//         super()
//     }
//     override visitRangeForStmt(stmt: RangeForStmt) {
//         if (stmt.isParallelFor) {
//             this.inParallelLoop = true
//         }
//     }
// }