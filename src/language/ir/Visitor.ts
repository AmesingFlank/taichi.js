import { error } from '../../utils/Logging';
import {
    AllocaStmt,
    ArgLoadStmt,
    AtomicLoadStmt,
    AtomicOpStmt,
    AtomicStoreStmt,
    BinaryOpStmt,
    Block,
    BuiltInInputStmt,
    BuiltInOutputStmt,
    CompositeExtractStmt,
    ConstStmt,
    ContinueStmt,
    DiscardStmt,
    FragmentDerivativeStmt,
    FragmentForStmt,
    FragmentInputStmt,
    GlobalLoadStmt,
    GlobalPtrStmt,
    GlobalStoreStmt,
    GlobalTemporaryLoadStmt,
    GlobalTemporaryStmt,
    GlobalTemporaryStoreStmt,
    IfStmt,
    IRModule,
    LocalLoadStmt,
    LocalStoreStmt,
    LoopIndexStmt,
    RandStmt,
    RangeForStmt,
    ReturnStmt,
    Stmt,
    StmtKind,
    TextureFunctionStmt,
    UnaryOpStmt,
    VertexForStmt,
    VertexInputStmt,
    VertexOutputStmt,
    WhileControlStmt,
    WhileStmt,
} from './Stmt';

export abstract class IRVisitor {
    visitModule(module: IRModule) {
        this.visitBlock(module.block);
    }
    visitBlock(block: Block) {
        for (let s of block.stmts) {
            this.visit(s);
        }
    }
    visit(stmt: Stmt) {
        switch (stmt.getKind()) {
            case StmtKind.ConstStmt:
                this.visitConstStmt(stmt as ConstStmt);
                break;
            case StmtKind.RangeForStmt:
                this.visitRangeForStmt(stmt as RangeForStmt);
                break;
            case StmtKind.LoopIndexStmt:
                this.visitLoopIndexStmt(stmt as LoopIndexStmt);
                break;
            case StmtKind.AllocaStmt:
                this.visitAllocaStmt(stmt as AllocaStmt);
                break;
            case StmtKind.LocalLoadStmt:
                this.visitLocalLoadStmt(stmt as LocalLoadStmt);
                break;
            case StmtKind.LocalStoreStmt:
                this.visitLocalStoreStmt(stmt as LocalStoreStmt);
                break;
            case StmtKind.GlobalPtrStmt:
                this.visitGlobalPtrStmt(stmt as GlobalPtrStmt);
                break;
            case StmtKind.GlobalLoadStmt:
                this.visitGlobalLoadStmt(stmt as GlobalLoadStmt);
                break;
            case StmtKind.GlobalStoreStmt:
                this.visitGlobalStoreStmt(stmt as GlobalStoreStmt);
                break;
            case StmtKind.GlobalTemporaryStmt:
                this.visitGlobalTemporaryStmt(stmt as GlobalTemporaryStmt);
                break;
            case StmtKind.GlobalTemporaryLoadStmt:
                this.visitGlobalTemporaryLoadStmt(stmt as GlobalTemporaryLoadStmt);
                break;
            case StmtKind.GlobalTemporaryStoreStmt:
                this.visitGlobalTemporaryStoreStmt(stmt as GlobalTemporaryStoreStmt);
                break;
            case StmtKind.BinaryOpStmt:
                this.visitBinaryOpStmt(stmt as BinaryOpStmt);
                break;
            case StmtKind.UnaryOpStmt:
                this.visitUnaryOpStmt(stmt as UnaryOpStmt);
                break;
            case StmtKind.WhileStmt:
                this.visitWhileStmt(stmt as WhileStmt);
                break;
            case StmtKind.IfStmt:
                this.visitIfStmt(stmt as IfStmt);
                break;
            case StmtKind.WhileControlStmt:
                this.visitWhileControlStmt(stmt as WhileControlStmt);
                break;
            case StmtKind.ContinueStmt:
                this.visitContinueStmt(stmt as ContinueStmt);
                break;
            case StmtKind.ArgLoadStmt:
                this.visitArgLoadStmt(stmt as ArgLoadStmt);
                break;
            case StmtKind.RandStmt:
                this.visitRandStmt(stmt as RandStmt);
                break;
            case StmtKind.ReturnStmt:
                this.visitReturnStmt(stmt as ReturnStmt);
                break;
            case StmtKind.AtomicOpStmt:
                this.visitAtomicOpStmt(stmt as AtomicOpStmt);
                break;
            case StmtKind.AtomicLoadStmt:
                this.visitAtomicLoadStmt(stmt as AtomicLoadStmt);
                break;
            case StmtKind.AtomicStoreStmt:
                this.visitAtomicStoreStmt(stmt as AtomicStoreStmt);
                break;
            case StmtKind.VertexForStmt:
                this.visitVertexForStmt(stmt as VertexForStmt);
                break;
            case StmtKind.FragmentForStmt:
                this.visitFragmentForStmt(stmt as FragmentForStmt);
                break;
            case StmtKind.VertexInputStmt:
                this.visitVertexInputStmt(stmt as VertexInputStmt);
                break;
            case StmtKind.VertexOutputStmt:
                this.visitVertexOutputStmt(stmt as VertexOutputStmt);
                break;
            case StmtKind.FragmentInputStmt:
                this.visitFragmentInputStmt(stmt as FragmentInputStmt);
                break;
            case StmtKind.BuiltInOutputStmt:
                this.visitBuiltInOutputStmt(stmt as BuiltInOutputStmt);
                break;
            case StmtKind.BuiltInInputStmt:
                this.visitBuiltInInputStmt(stmt as BuiltInInputStmt);
                break;
            case StmtKind.FragmentDerivativeStmt:
                this.visitFragmentDerivativeStmt(stmt as FragmentDerivativeStmt);
                break;
            case StmtKind.DiscardStmt:
                this.visitDiscardStmt(stmt as DiscardStmt);
                break;
            case StmtKind.TextureFunctionStmt:
                this.visitTextureFunctionStmt(stmt as TextureFunctionStmt);
                break;
            case StmtKind.CompositeExtractStmt:
                this.visitCompositeExtractStmt(stmt as CompositeExtractStmt);
                break;
            default:
                error('unrecognized stmt: ', stmt);
        }
    }
    visitConstStmt(stmt: ConstStmt) {}
    visitRangeForStmt(stmt: RangeForStmt) {
        this.visitBlock(stmt.body);
    }
    visitLoopIndexStmt(stmt: LoopIndexStmt) {}
    visitAllocaStmt(stmt: AllocaStmt) {}
    visitLocalLoadStmt(stmt: LocalLoadStmt) {}
    visitLocalStoreStmt(stmt: LocalStoreStmt) {}
    visitGlobalPtrStmt(stmt: GlobalPtrStmt) {}
    visitGlobalLoadStmt(stmt: GlobalLoadStmt) {}
    visitGlobalStoreStmt(stmt: GlobalStoreStmt) {}
    visitGlobalTemporaryStmt(stmt: GlobalTemporaryStmt) {}
    visitGlobalTemporaryLoadStmt(stmt: GlobalTemporaryLoadStmt) {}
    visitGlobalTemporaryStoreStmt(stmt: GlobalTemporaryStoreStmt) {}
    visitBinaryOpStmt(stmt: BinaryOpStmt) {}
    visitUnaryOpStmt(stmt: UnaryOpStmt) {}
    visitWhileStmt(stmt: WhileStmt) {
        this.visitBlock(stmt.body);
    }
    visitIfStmt(stmt: IfStmt) {
        this.visitBlock(stmt.trueBranch);
        this.visitBlock(stmt.falseBranch);
    }
    visitWhileControlStmt(stmt: WhileControlStmt) {}
    visitContinueStmt(stmt: ContinueStmt) {}
    visitArgLoadStmt(stmt: ArgLoadStmt) {}
    visitRandStmt(stmt: RandStmt) {}
    visitReturnStmt(stmt: ReturnStmt) {}
    visitAtomicOpStmt(stmt: AtomicOpStmt) {}
    visitAtomicLoadStmt(stmt: AtomicLoadStmt) {}
    visitAtomicStoreStmt(stmt: AtomicStoreStmt) {}
    visitVertexForStmt(stmt: VertexForStmt) {
        this.visitBlock(stmt.body);
    }
    visitFragmentForStmt(stmt: FragmentForStmt) {
        this.visitBlock(stmt.body);
    }
    visitVertexInputStmt(stmt: VertexInputStmt) {}
    visitVertexOutputStmt(stmt: VertexOutputStmt) {}
    visitFragmentInputStmt(stmt: FragmentInputStmt) {}
    visitBuiltInOutputStmt(stmt: BuiltInOutputStmt) {}
    visitBuiltInInputStmt(stmt: BuiltInInputStmt) {}
    visitFragmentDerivativeStmt(stmt: FragmentDerivativeStmt) {}
    visitDiscardStmt(stmt: DiscardStmt) {}
    visitTextureFunctionStmt(stmt: TextureFunctionStmt) {}
    visitCompositeExtractStmt(stmt: CompositeExtractStmt) {}
}
