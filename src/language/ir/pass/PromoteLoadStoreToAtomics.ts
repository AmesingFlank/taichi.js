import { AtomicLoadStmt, AtomicOpStmt, AtomicStoreStmt, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, GlobalTemporaryLoadStmt, GlobalTemporaryStoreStmt, IfStmt, IRModule, LocalStoreStmt, PointerStmt, ReturnStmt, Stmt, StmtKind, WhileStmt } from "../Stmt";
import { IRTransformer } from "../Transformer";
import { IRVisitor } from "../Visitor";
import { DelayedStmtReplacer } from "./Replacer";


// If a buffer is used atomically at any point, all accesses to this buffer must be atomic

class IdentifyAtomicResources extends IRVisitor {
    constructor() {
        super()
    }
    public atomicTrees = new Set<number>()
    public atomicGtemps: boolean = false

    maybeMarkAtomics(pointer: PointerStmt) {
        if (pointer.getKind() == StmtKind.GlobalPtrStmt) {
            let gloablPtr = pointer as GlobalPtrStmt
            let treeId = gloablPtr.field.snodeTree.treeId
            this.atomicTrees.add(treeId)
        }
        else if (pointer.getKind() == StmtKind.GlobalTemporaryStmt) {
            this.atomicGtemps = true
        }
    }

    override visitAtomicOpStmt(stmt: AtomicOpStmt): void {
        let dest = stmt.getDestination()
        this.maybeMarkAtomics(dest)
    }
    override visitAtomicLoadStmt(stmt: AtomicLoadStmt): void {
        let ptr = stmt.getPointer()
        this.maybeMarkAtomics(ptr)
    }
    override visitAtomicStoreStmt(stmt: AtomicStoreStmt): void {
        let ptr = stmt.getPointer()
        this.maybeMarkAtomics(ptr)
    }
}

class PromoteLoadStores extends IRTransformer {
    atomicTrees: Set<number>
    atomicGtemps: boolean

    replacer = new DelayedStmtReplacer()

    constructor(atomicTrees: Set<number>, atomicGtemps: boolean) {
        super()
        this.atomicTrees = atomicTrees
        this.atomicGtemps = atomicGtemps
    }
    override visitGlobalLoadStmt(stmt: GlobalLoadStmt): void {
        let ptr = stmt.getPointer()
        if (this.atomicTrees.has(ptr.field.snodeTree.treeId)) {
            let atomicLoad = this.pushNewStmt(new AtomicLoadStmt(ptr, this.module.getNewId()))
            this.replacer.markReplace(stmt, atomicLoad)
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override visitGlobalStoreStmt(stmt: GlobalStoreStmt): void {
        let ptr = stmt.getPointer()
        if (this.atomicTrees.has(ptr.field.snodeTree.treeId)) {
            this.pushNewStmt(new AtomicStoreStmt(ptr, stmt.getValue(), this.module.getNewId()))
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override visitGlobalTemporaryLoadStmt(stmt: GlobalTemporaryLoadStmt): void {
        let ptr = stmt.getPointer()
        if (this.atomicGtemps) {
            let atomicLoad = this.pushNewStmt(new AtomicLoadStmt(ptr, this.module.getNewId()))
            this.replacer.markReplace(stmt, atomicLoad)
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override visitGlobalTemporaryStoreStmt(stmt: GlobalTemporaryStoreStmt): void {
        let ptr = stmt.getPointer()
        if (this.atomicGtemps) {
            this.pushNewStmt(new AtomicStoreStmt(ptr, stmt.getValue(), this.module.getNewId()))
        }
        else {
            this.pushNewStmt(stmt)
        }
    }
    override transform(module: IRModule): void {
        super.transform(module)
        this.replacer.transform(module)
    }
}

export function promoteLoadStoreToAtomics(module: IRModule) {
    let identify = new IdentifyAtomicResources()
    identify.visitModule(module)
    let promote = new PromoteLoadStores(identify.atomicTrees, identify.atomicGtemps)
    promote.transform(module)
    return module
}