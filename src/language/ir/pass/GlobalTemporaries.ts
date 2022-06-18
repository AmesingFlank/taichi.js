import { error } from "../../../utils/Logging"
import { PrimitiveType } from "../../frontend/Type"
import { WhileStmt, IfStmt, VertexForStmt, FragmentForStmt, RangeForStmt, Stmt, AllocaStmt, LocalLoadStmt, LocalStoreStmt, AtomicOpStmt, StmtKind, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, IRModule, GlobalTemporaryStoreStmt, isPointerStmt } from "../Stmt"
import { IRTransformer } from "../Transformer"
import { IRVisitor } from "../Visitor"
import { DelayedStmtReplacer } from "./Replacer"



class IdentifyAllocasUsedInParallelForsPass extends IRVisitor {
    inParallelLoop: boolean = false

    serialAllocas: Set<Stmt> = new Set<Stmt>()
    maybeAllocateGtemp(alloca: AllocaStmt) {
        if (this.inParallelLoop && this.serialAllocas.has(alloca) && !this.gtempsAllocation.has(alloca)) {
            let offset = this.gtempsAllocation.size + this.nextAvailableGtemp
            this.gtempsAllocation.set(alloca, offset)
        }
    }

    gtempsAllocation: Map<Stmt, number> = new Map<Stmt, number>()

    constructor(public nextAvailableGtemp: number) {
        super()
    }

    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitRangeForStmt(stmt)
        if (stmt.isParallelFor) {
            this.inParallelLoop = false
        }
    }
    override visitVertexForStmt(stmt: VertexForStmt) {
        this.inParallelLoop = true
        super.visitVertexForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        this.inParallelLoop = true
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

class ReplaceAllocasUsedInParallelForsPass extends IRTransformer {
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
                let atomicStmt = new AtomicOpStmt(gtemp, stmt.getOperand(), stmt.op, this.module.getNewId())
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

class IdentifyValuesUsedInParallelForsPass extends IRVisitor {
    inParallelLoop: boolean = false

    serialValues: Set<Stmt> = new Set<Stmt>()

    gtempsAllocation: Map<Stmt, number> = new Map<Stmt, number>()

    constructor(public nextAvailableGtemp: number) {
        super()
    }

    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitRangeForStmt(stmt)
        if (stmt.isParallelFor) {
            this.inParallelLoop = false
        }
    }
    override visitVertexForStmt(stmt: VertexForStmt) {
        this.inParallelLoop = true
        super.visitVertexForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        this.inParallelLoop = true
        super.visitFragmentForStmt(stmt)
        this.inParallelLoop = false
    }

    override visit(stmt: Stmt): void {
        if (!this.inParallelLoop && !isPointerStmt(stmt) && stmt.returnType !== undefined) {
            this.serialValues.add(stmt)
        }
        if (this.inParallelLoop) {
            for (let op of stmt.operands) {
                if (this.serialValues.has(op) && !this.gtempsAllocation.has(op)) {
                    let offset = this.gtempsAllocation.size + this.nextAvailableGtemp
                    this.gtempsAllocation.set(op, offset)
                }
            }
        }
        super.visit(stmt)
    }
}

class ReplaceValuesUsedInParallelForsPass extends IRTransformer {
    inParallelLoop: boolean = false

    constructor(public gtempsAllocation: Map<Stmt, number>) {
        super()
    }

    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            this.inParallelLoop = true
        }
        super.visitRangeForStmt(stmt)
        if (stmt.isParallelFor) {
            this.inParallelLoop = false
        }
    }
    override visitVertexForStmt(stmt: VertexForStmt) {
        this.inParallelLoop = true
        super.visitVertexForStmt(stmt)
        this.inParallelLoop = false
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        this.inParallelLoop = true
        super.visitFragmentForStmt(stmt)
        this.inParallelLoop = false
    }

    override visit(stmt: Stmt): void {
        if (this.inParallelLoop) {
            for (let i = 0; i < stmt.operands.length; ++i) {
                if (this.gtempsAllocation.has(stmt.operands[i])) {
                    let offset = this.gtempsAllocation.get(stmt.operands[i])!
                    let gtemp = new GlobalTemporaryStmt(stmt.getReturnType(), offset, this.module.getNewId())
                    this.pushNewStmt(gtemp)
                    let gtempLoad = new GlobalTemporaryLoadStmt(gtemp, this.module.getNewId())
                    this.pushNewStmt(gtempLoad)
                    stmt.operands[i] = gtempLoad
                }
            }
        }
        super.visit(stmt)
        if (!this.inParallelLoop && this.gtempsAllocation.has(stmt)) {
            let offset = this.gtempsAllocation.get(stmt)!
            let gtemp = new GlobalTemporaryStmt(stmt.getReturnType(), offset, this.module.getNewId())
            this.pushNewStmt(gtemp)
            let gtempStore = new GlobalTemporaryStoreStmt(gtemp, stmt, this.module.getNewId())
            this.pushNewStmt(gtempStore)
        }
    }
}

class LoopRangeGtempPass extends IRTransformer {
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
    override visitVertexForStmt(stmt: RangeForStmt) {
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
    let nextAvailableGtemp = 0

    let identifyAllocasUsedInParallelFors = new IdentifyAllocasUsedInParallelForsPass(nextAvailableGtemp)
    identifyAllocasUsedInParallelFors.visitModule(module)
    let allocations = identifyAllocasUsedInParallelFors.gtempsAllocation

    new ReplaceAllocasUsedInParallelForsPass(allocations).transform(module)

    nextAvailableGtemp += allocations.size

    let identifyValuesUsedInParallelFors = new IdentifyValuesUsedInParallelForsPass(nextAvailableGtemp)
    identifyValuesUsedInParallelFors.visitModule(module)
    allocations = identifyValuesUsedInParallelFors.gtempsAllocation

    new ReplaceValuesUsedInParallelForsPass(allocations).transform(module)

    nextAvailableGtemp += allocations.size

    let loopRange = new LoopRangeGtempPass(nextAvailableGtemp)
    loopRange.transform(module)
}