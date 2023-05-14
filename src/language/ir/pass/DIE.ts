import {
    GlobalLoadStmt,
    GlobalTemporaryStoreStmt,
    IfStmt,
    IRModule,
    LocalStoreStmt,
    ReturnStmt,
    Stmt,
    StmtKind,
    WhileStmt,
} from '../Stmt';
import { IRTransformer } from '../Transformer';
import { IRVisitor } from '../Visitor';

class IdentifyUsefulInstructions extends IRVisitor {
    constructor() {
        super();
    }
    public usefulInstructions: Set<Stmt> = new Set<Stmt>();
    override visit(stmt: Stmt): void {
        let kind = stmt.getKind();
        if (
            [
                StmtKind.GlobalStoreStmt,
                StmtKind.LocalStoreStmt,
                StmtKind.GlobalTemporaryStoreStmt,
                StmtKind.ReturnStmt,
                StmtKind.AtomicOpStmt,
                StmtKind.AtomicLoadStmt,
                StmtKind.AtomicStoreStmt,
                StmtKind.IfStmt,
                StmtKind.WhileStmt,
                StmtKind.RangeForStmt,
                StmtKind.FragmentForStmt,
                StmtKind.VertexForStmt,
                StmtKind.WhileControlStmt,
                StmtKind.ContinueStmt,
                StmtKind.DiscardStmt,
                StmtKind.VertexOutputStmt,
                StmtKind.BuiltInOutputStmt,
                StmtKind.TextureFunctionStmt,
            ].includes(kind)
        ) {
            this.usefulInstructions.add(stmt);
        }
        super.visit(stmt);
    }

    override visitModule(module: IRModule): void {
        super.visitModule(module);
        let existingUseful = this.usefulInstructions;
        this.usefulInstructions = new Set<Stmt>();
        existingUseful.forEach((stmt: Stmt) => {
            this.recursiveMarkUseful(stmt);
        });
    }

    recursiveMarkUseful(stmt: Stmt) {
        if (this.usefulInstructions.has(stmt)) {
            return;
        }
        this.usefulInstructions.add(stmt);
        for (let operand of stmt.operands) {
            this.recursiveMarkUseful(operand);
        }
    }
}

class EliminatePass extends IRTransformer {
    constructor(public usefulInstructions: Set<Stmt>) {
        super();
    }
    override visit(stmt: Stmt): void {
        if (!this.usefulInstructions.has(stmt)) {
            return;
        }
        super.visit(stmt);
    }
}

export function deadInstructionElimination(module: IRModule) {
    let identify = new IdentifyUsefulInstructions();
    identify.visitModule(module);
    let useful = identify.usefulInstructions;
    let elim = new EliminatePass(useful);
    elim.transform(module);
}
