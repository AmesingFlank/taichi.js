import { AllocaStmt, AtomicOpStmt, AtomicOpType, BinaryOpStmt, BinaryOpType, IRModule, LocalLoadStmt, LocalStoreStmt, StmtKind } from "../Stmt";
import { IRTransformer } from "../Transformer";
import { DelayedStmtReplacer } from "./Replacer";


class DemoteAtomicsPass extends IRTransformer {
    replacer = new DelayedStmtReplacer()
    override visitAtomicOpStmt(stmt: AtomicOpStmt) {
        if (stmt.getDestination().getKind() !== StmtKind.AllocaStmt) {
            this.pushNewStmt(stmt)
            return;
        }
        let dest = stmt.getDestination() as AllocaStmt
        let lhs = this.pushNewStmt(new LocalLoadStmt(dest, this.module.getNewId()))
        let rhs = stmt.getOperand()
        let atomicOpToBinaryOp = (op: AtomicOpType) => {
            switch (op) {
                case AtomicOpType.add: return BinaryOpType.add
                case AtomicOpType.sub: return BinaryOpType.sub
                case AtomicOpType.max: return BinaryOpType.max
                case AtomicOpType.min: return BinaryOpType.min
                case AtomicOpType.bit_and: return BinaryOpType.bit_and
                case AtomicOpType.bit_or: return BinaryOpType.bit_or
                case AtomicOpType.bit_xor: return BinaryOpType.bit_xor
            }
        }
        let binaryOp: BinaryOpType = atomicOpToBinaryOp(stmt.op)
        let binaryOpStmt = this.pushNewStmt(new BinaryOpStmt(lhs, rhs, binaryOp, this.module.getNewId()))
        this.replacer.markReplace(stmt, binaryOpStmt)
        this.pushNewStmt(new LocalStoreStmt(dest, binaryOpStmt, this.module.getNewId()))
    }
    override transform(module: IRModule): void {
        super.transform(module)
        this.replacer.transform(module)
    }
}

export function demoteAtomics(module: IRModule) {
    let pass = new DemoteAtomicsPass()
    pass.transform(module)
    return module
}