import { error } from "../../../utils/Logging"
import { PrimitiveType } from "../../frontend/Type"
import { WhileStmt, IfStmt, VertexForStmt, FragmentForStmt, RangeForStmt, Stmt, AllocaStmt, LocalLoadStmt, LocalStoreStmt, AtomicOpStmt, StmtKind, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, IRModule, GlobalTemporaryStoreStmt } from "../Stmt"
import { IRTransformer } from "../Transformer"
import { IRVisitor } from "../Visitor"
import { DelayedStmtReplacer } from "./Replacer"



export class AllocGtempsPass extends IRVisitor {
    inParallelLoop: boolean = false

    serialAllocas: Set<Stmt> = new Set<Stmt>()
    maybeAllocateGtemp(alloca: AllocaStmt) {
        if (this.inParallelLoop && this.serialAllocas.has(alloca) && !this.gtempsAllocation.has(alloca)) {
            let offset = this.gtempsAllocation.size
            this.gtempsAllocation.set(alloca, offset)
        }
    }

    gtempsAllocation: Map<Stmt, number> = new Map<Stmt, number>()

    constructor() {
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

export class ReplaceGtempPass extends IRTransformer {
    replacer: DelayedStmtReplacer = new DelayedStmtReplacer
    constructor(public gtempsAllocation: Map<Stmt, number>) {
        super()
    }
    maybeGetReplacementGtemp(stmt: AllocaStmt) {
        if (this.gtempsAllocation.has(stmt)) {
            let gtempId = this.gtempsAllocation.get(stmt)!
            let gtemp = new GlobalTemporaryStmt(stmt.allocatedType, gtempId, this.module.getNewId())
            return gtemp
        }
        return undefined
    }
    override visitLocalLoadStmt(stmt: LocalLoadStmt): void {
        let gtemp = this.maybeGetReplacementGtemp(stmt.getPointer())
        if (gtemp) {
            let gtempLoadStmt = new GlobalTemporaryLoadStmt(gtemp, this.module.getNewId())
            this.pushNewStmt(gtemp)
            this.pushNewStmt(gtempLoadStmt)
            this.replacer.markReplace(stmt, gtempLoadStmt)
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override visitLocalStoreStmt(stmt: LocalStoreStmt): void {
        let gtemp = this.maybeGetReplacementGtemp(stmt.getPointer())
        if (gtemp) {
            let gtempStoreStmt = new GlobalTemporaryStoreStmt(gtemp, stmt.getValue(), this.module.getNewId())
            this.pushNewStmt(gtemp)
            this.pushNewStmt(gtempStoreStmt)
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override visitAtomicOpStmt(stmt: AtomicOpStmt): void {
        if (stmt.getDestination().getKind() === StmtKind.AllocaStmt) {
            let alloca = stmt.getDestination() as AllocaStmt
            let gtemp = this.maybeGetReplacementGtemp(alloca)
            if (gtemp) {
                let atomicStmt = new AtomicOpStmt(stmt.op, gtemp, stmt.getOperand(), this.module.getNewId())
                this.pushNewStmt(gtemp)
                this.pushNewStmt(atomicStmt)
                this.replacer.markReplace(stmt, atomicStmt)
                return
            }
        }
        this.pushNewStmt(stmt)
    }
    override transform(module: IRModule): void {
        super.transform(module)
        this.replacer.transform(module)
    }
}

export class LoopRangeGtempPass extends IRTransformer {
    constructor(public nextGtempSlot: number) {
        super()
    }
    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            let range = stmt.getRange()
            if (range.returnType !== PrimitiveType.i32) {
                error("Internal Error: The range of a range-for must be an i32")
            }
            if (range.getKind() !== StmtKind.ConstStmt && range.getKind() !== StmtKind.GlobalTemporaryLoadStmt) {
                let slot = this.nextGtempSlot++
                let gtemp = new GlobalTemporaryStmt(PrimitiveType.i32, slot, this.module.getNewId())
                let gtempStore = new GlobalTemporaryStoreStmt(gtemp, range, this.module.getNewId())
                let gtempLoad = new GlobalTemporaryLoadStmt(gtemp, this.module.getNewId())
                this.pushNewStmt(gtemp)
                this.pushNewStmt(gtempStore)
                this.pushNewStmt(gtempLoad)
                stmt.setRange(gtempLoad)
            }
        }
        super.visitRangeForStmt(stmt)
    }
}

export function insertGlobalTemporaries(module: IRModule) {
    let alloc = new AllocGtempsPass()
    alloc.visitModule(module)
    let allocations = alloc.gtempsAllocation

    let replace = new ReplaceGtempPass(allocations)
    replace.transform(module)

    let loopRange = new LoopRangeGtempPass(allocations.size)
    loopRange.transform(module)
}