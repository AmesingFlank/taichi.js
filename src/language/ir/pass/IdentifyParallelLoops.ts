import { IRBuilder } from '../Builder';
import { Block, IRModule, RangeForStmt } from '../Stmt';
import { IRVisitor } from '../Visitor';

class IdentifyParallelLoopsPass extends IRVisitor {
    override visitModule(module: IRModule) {
        for (let stmt of module.block.stmts) {
            this.visit(stmt);
        }
    }
    override visitBlock(block: Block) {}
    override visitRangeForStmt(stmt: RangeForStmt) {
        stmt.isParallelFor = !stmt.strictlySerialize;
    }
}

export function identifyParallelLoops(module: IRModule) {
    let pass = new IdentifyParallelLoopsPass();
    pass.visitModule(module);
}
