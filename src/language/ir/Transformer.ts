import { Guard, IRBuilder } from "./Builder";
import { AllocaStmt, ArgLoadStmt, AtomicLoadStmt, AtomicOpStmt, AtomicStoreStmt, BinaryOpStmt, Block, BuiltInInputStmt, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, DiscardStmt, FragmentDerivativeStmt, FragmentForStmt, FragmentInputStmt, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, GlobalTemporaryStoreStmt, IfStmt, IRModule, LocalLoadStmt, LocalStoreStmt, LoopIndexStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, TextureFunctionStmt, UnaryOpStmt, VertexForStmt, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "./Stmt";
import { IRVisitor } from "./Visitor";

export class IRTransformer extends IRVisitor {

    guards: Guard[] = []

    module: IRModule = new IRModule;

    transform(module: IRModule) {
        this.module = module;
        this.visitBlock(module.block)
    }

    pushNewStmt(stmt: Stmt) {
        this.guards.at(-1)!.block.stmts.push(stmt)
        return stmt
    }

    addGuard(block: Block) {
        let guard = new Guard(this, block)
        this.guards.push(guard)
        return guard
    }

    override visitBlock(block: Block) {
        let result = new Block
        let guard = this.addGuard(result)
        for (let s of block.stmts) {
            this.visit(s)
        }
        guard.delete()
        block.stmts = result.stmts
    }

    override visitConstStmt(stmt: ConstStmt) {
        this.pushNewStmt(stmt)
    }
    override visitRangeForStmt(stmt: RangeForStmt) {
        this.pushNewStmt(stmt)
        this.visitBlock(stmt.body)
    }
    override visitLoopIndexStmt(stmt: LoopIndexStmt) {
        this.pushNewStmt(stmt)
    }
    override visitAllocaStmt(stmt: AllocaStmt) {
        this.pushNewStmt(stmt)
    }
    override visitLocalLoadStmt(stmt: LocalLoadStmt) {
        this.pushNewStmt(stmt)
    }
    override visitLocalStoreStmt(stmt: LocalStoreStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalPtrStmt(stmt: GlobalPtrStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalLoadStmt(stmt: GlobalLoadStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalStoreStmt(stmt: GlobalStoreStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalTemporaryStmt(stmt: GlobalTemporaryStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalTemporaryLoadStmt(stmt: GlobalTemporaryLoadStmt) {
        this.pushNewStmt(stmt)
    }
    override visitGlobalTemporaryStoreStmt(stmt: GlobalTemporaryStoreStmt) {
        this.pushNewStmt(stmt)
    }
    override visitBinaryOpStmt(stmt: BinaryOpStmt) {
        this.pushNewStmt(stmt)
    }
    override visitUnaryOpStmt(stmt: UnaryOpStmt) {
        this.pushNewStmt(stmt)
    }
    override visitWhileStmt(stmt: WhileStmt) {
        this.pushNewStmt(stmt)
        this.visitBlock(stmt.body)
    }
    override visitIfStmt(stmt: IfStmt) {
        this.pushNewStmt(stmt)
        this.visitBlock(stmt.trueBranch)
        this.visitBlock(stmt.falseBranch)
    }
    override visitWhileControlStmt(stmt: WhileControlStmt) {
        this.pushNewStmt(stmt)
    }
    override visitContinueStmt(stmt: ContinueStmt) {
        this.pushNewStmt(stmt)
    }
    override visitArgLoadStmt(stmt: ArgLoadStmt) {
        this.pushNewStmt(stmt)
    }
    override visitRandStmt(stmt: RandStmt) {
        this.pushNewStmt(stmt)
    }
    override visitReturnStmt(stmt: ReturnStmt) {
        this.pushNewStmt(stmt)
    }
    override visitAtomicOpStmt(stmt: AtomicOpStmt) {
        this.pushNewStmt(stmt)
    }
    override visitAtomicLoadStmt(stmt: AtomicLoadStmt) {
        this.pushNewStmt(stmt)
    }
    override visitAtomicStoreStmt(stmt: AtomicStoreStmt) {
        this.pushNewStmt(stmt)
    }
    override visitVertexForStmt(stmt: VertexForStmt) {
        this.pushNewStmt(stmt)
        this.visitBlock(stmt.body)
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        this.pushNewStmt(stmt)
        this.visitBlock(stmt.body)
    }
    override visitVertexInputStmt(stmt: VertexInputStmt) {
        this.pushNewStmt(stmt)
    }
    override visitVertexOutputStmt(stmt: VertexOutputStmt) {
        this.pushNewStmt(stmt)
    }
    override visitFragmentInputStmt(stmt: FragmentInputStmt) {
        this.pushNewStmt(stmt)
    }
    override visitBuiltInOutputStmt(stmt: BuiltInOutputStmt) {
        this.pushNewStmt(stmt)
    }
    override visitBuiltInInputStmt(stmt: BuiltInInputStmt) {
        this.pushNewStmt(stmt)
    }
    override visitFragmentDerivativeStmt(stmt: FragmentDerivativeStmt) {
        this.pushNewStmt(stmt)
    }
    override visitDiscardStmt(stmt: DiscardStmt) {
        this.pushNewStmt(stmt)
    }
    override visitTextureFunctionStmt(stmt: TextureFunctionStmt) {
        this.pushNewStmt(stmt)
    }
    override visitCompositeExtractStmt(stmt: CompositeExtractStmt) {
        this.pushNewStmt(stmt)
    }
}