import { error } from "../utils/Logging";
import { AllocaStmt, ArgLoadStmt, AtomicOpStmt, BinaryOpStmt, BuiltInInputStmt, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, DiscardStmt, FragmentDerivativeStmt, FragmentForStmt, FragmentInputStmt, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, IfStmt, LocalLoadStmt, LocalStoreStmt, LoopIndexStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, StmtKind, TextureFunctionStmt, UnaryOpStmt, VertexForStmt, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "./Stmt";


export abstract class StmtVisitor {
    run(stmts: Stmt[]) {
        for (let s of stmts) {
            this.visit(s)
        }
    }
    visit(stmt: Stmt) {
        switch (stmt.getKind()) {
            case StmtKind.ConstStmt:
                this.visitConstStmt(stmt as ConstStmt)
            case StmtKind.RangeForStmt:
                this.visitRangeForStmt(stmt as RangeForStmt)
            case StmtKind.LoopIndexStmt:
                this.visitLoopIndexStmt(stmt as LoopIndexStmt)
            case StmtKind.AllocaStmt:
                this.visitAllocaStmt(stmt as AllocaStmt)
            case StmtKind.LocalLoadStmt:
                this.visitLocalLoadStmt(stmt as LocalLoadStmt)
            case StmtKind.LocalStoreStmt:
                this.visitLocalStoreStmt(stmt as LocalStoreStmt)
            case StmtKind.GlobalPtrStmt:
                this.visitGlobalPtrStmt(stmt as GlobalPtrStmt)
            case StmtKind.GlobalLoadStmt:
                this.visitGlobalLoadStmt(stmt as GlobalLoadStmt)
            case StmtKind.GlobalStoreStmt:
                this.visitGlobalStoreStmt(stmt as GlobalStoreStmt)
            case StmtKind.BinaryOpStmt:
                this.visitBinaryOpStmt(stmt as BinaryOpStmt)
            case StmtKind.UnaryOpStmt:
                this.visitUnaryOpStmt(stmt as UnaryOpStmt)
            case StmtKind.WhileStmt:
                this.visitWhileStmt(stmt as WhileStmt)
            case StmtKind.IfStmt:
                this.visitIfStmt(stmt as IfStmt)
            case StmtKind.WhileControlStmt:
                this.visitWhileControlStmt(stmt as WhileControlStmt)
            case StmtKind.ContinueStmt:
                this.visitContinueStmt(stmt as ContinueStmt)
            case StmtKind.ArgLoadStmt:
                this.visitArgLoadStmt(stmt as ArgLoadStmt)
            case StmtKind.RandStmt:
                this.visitRandStmt(stmt as RandStmt)
            case StmtKind.ReturnStmt:
                this.visitReturnStmt(stmt as ReturnStmt)
            case StmtKind.AtomicOpStmt:
                this.visitAtomicOpStmt(stmt as AtomicOpStmt)
            case StmtKind.VertexForStmt:
                this.visitVertexForStmt(stmt as VertexForStmt)
            case StmtKind.FragmentForStmt:
                this.visitFragmentForStmt(stmt as FragmentForStmt)
            case StmtKind.VertexInputStmt:
                this.visitVertexInputStmt(stmt as VertexInputStmt)
            case StmtKind.VertexOutputStmt:
                this.visitVertexOutputStmt(stmt as VertexOutputStmt)
            case StmtKind.FragmentInputStmt:
                this.visitFragmentInputStmt(stmt as FragmentInputStmt)
            case StmtKind.BuiltInOutputStmt:
                this.visitBuiltInOutputStmt(stmt as BuiltInOutputStmt)
            case StmtKind.BuiltInInputStmt:
                this.visitBuiltInInputStmt(stmt as BuiltInInputStmt)
            case StmtKind.FragmentDerivativeStmt:
                this.visitFragmentDerivativeStmt(stmt as FragmentDerivativeStmt)
            case StmtKind.DiscardStmt:
                this.visitDiscardStmt(stmt as DiscardStmt)
            case StmtKind.TextureFunctionStmt:
                this.visitTextureFunctionStmt(stmt as TextureFunctionStmt)
            case StmtKind.CompositeExtractStmt:
                this.visitCompositeExtractStmt(stmt as CompositeExtractStmt)
            default:
                error("unrecognized stmt: ", stmt)
        }
    }
    visitConstStmt(stmt: ConstStmt) {

    }
    visitRangeForStmt(stmt: RangeForStmt) {
        for (let s of stmt.body.stmts) {
            this.visit(s)
        }
    }
    visitLoopIndexStmt(stmt: LoopIndexStmt) { }
    visitAllocaStmt(stmt: AllocaStmt) { }
    visitLocalLoadStmt(stmt: LocalLoadStmt) { }
    visitLocalStoreStmt(stmt: LocalStoreStmt) { }
    visitGlobalPtrStmt(stmt: GlobalPtrStmt) { }
    visitGlobalLoadStmt(stmt: GlobalLoadStmt) { }
    visitGlobalStoreStmt(stmt: GlobalStoreStmt) { }
    visitBinaryOpStmt(stmt: BinaryOpStmt) { }
    visitUnaryOpStmt(stmt: UnaryOpStmt) { }
    visitWhileStmt(stmt: WhileStmt) { }
    visitIfStmt(stmt: IfStmt) { }
    visitWhileControlStmt(stmt: WhileControlStmt) { }
    visitContinueStmt(stmt: ContinueStmt) { }
    visitArgLoadStmt(stmt: ArgLoadStmt) { }
    visitRandStmt(stmt: RandStmt) { }
    visitReturnStmt(stmt: ReturnStmt) { }
    visitAtomicOpStmt(stmt: AtomicOpStmt) { }
    visitVertexForStmt(stmt: VertexForStmt) {
        for (let s of stmt.body.stmts) {
            this.visit(s)
        }
    }
    visitFragmentForStmt(stmt: FragmentForStmt) {
        for (let s of stmt.body.stmts) {
            this.visit(s)
        }
    }
    visitVertexInputStmt(stmt: VertexInputStmt) { }
    visitVertexOutputStmt(stmt: VertexOutputStmt) { }
    visitFragmentInputStmt(stmt: FragmentInputStmt) { }
    visitBuiltInOutputStmt(stmt: BuiltInOutputStmt) { }
    visitBuiltInInputStmt(stmt: BuiltInInputStmt) { }
    visitFragmentDerivativeStmt(stmt: FragmentDerivativeStmt) { }
    visitDiscardStmt(stmt: DiscardStmt) { }
    visitTextureFunctionStmt(stmt: TextureFunctionStmt) { }
    visitCompositeExtractStmt(stmt: CompositeExtractStmt) { }
}