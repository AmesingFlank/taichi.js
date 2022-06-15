import { assert, error } from "../../utils/Logging";
import { Guard } from "../ir/Builder";
import { ConstStmt, ContinueStmt, FragmentForStmt, GlobalTemporaryLoadStmt, IRModule, RangeForStmt, Stmt, StmtKind, VertexForStmt } from "../ir/Stmt";
import { IRTransformer } from "../ir/Transformer";
import { IRVisitor } from "../ir/Visitor";


export enum OffloadType {
    Serial,
    Compute,
    Vertex,
    Fragment
}

export class OffloadedModule extends IRModule {
    constructor(
        public type: OffloadType
    ) {
        super()
    }
}

export class SerialModule extends OffloadedModule {
    constructor() {
        super(OffloadType.Serial)
    }
}

export class ComputeModule extends OffloadedModule {
    constructor(public rangeArg: number, public hasConstRange: boolean) {
        super(OffloadType.Compute)
    }
}

export class VertexModule extends OffloadedModule {
    constructor() {
        super(OffloadType.Vertex)
    }
}

export class FragmentModule extends OffloadedModule {
    constructor() {
        super(OffloadType.Compute)
    }
}



class OffloadingPass extends IRTransformer {
    offloadedModules: OffloadedModule[] = []
    currentOffloadType: OffloadType = OffloadType.Serial

    override transform(module: IRModule): void {
        for (let s of module.block.stmts) {
            this.visit(s)
        }
    }

    resetTransformerState(module: OffloadedModule) {
        this.guards = []
        this.module = module
        this.addGuard(module.block)
    }

    override pushNewStmt(stmt: Stmt): Stmt {
        if (this.offloadedModules.length === 0) {
            assert(this.currentOffloadType === OffloadType.Serial, "InternalError: expecting serial state")
            let module = new OffloadedModule(this.currentOffloadType)
            this.offloadedModules.push(module)
            this.resetTransformerState(module)
        }
        return super.pushNewStmt(stmt)
    }

    override visitRangeForStmt(stmt: RangeForStmt) {
        if (stmt.isParallelFor) {
            let rangeArg = 0
            let isConst = false
            let range = stmt.getRange()
            if (range.getKind() === StmtKind.ConstStmt) {
                isConst = true
                rangeArg = (range as ConstStmt).val
            }
            else if (range.getKind() === StmtKind.GlobalTemporaryLoadStmt) {
                isConst = false
                rangeArg = (range as GlobalTemporaryLoadStmt).getPointer().offset
            }
            else {
                error("InternalError: range of be const or global temp load")
            }
            let module = new ComputeModule(rangeArg, isConst)
            this.resetTransformerState(module)
            for (let s of stmt.body.stmts) {
                this.visit(s)
            }
        }
        else {
            super.visitRangeForStmt(stmt)
        }
    }
    override visitVertexForStmt(stmt: VertexForStmt) {
        let module = new VertexModule
        this.resetTransformerState(module)
        for (let s of stmt.body.stmts) {
            this.visit(s)
        }
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        let module = new FragmentModule
        this.resetTransformerState(module)
        for (let s of stmt.body.stmts) {
            this.visit(s)
        }
    }
    override visitContinueStmt(stmt: ContinueStmt): void {
        stmt.parentBlock = this.guards.at(-1)!.block
        super.visitContinueStmt(stmt)
    }
}

export function offload(module: IRModule) {
    let pass = new OffloadingPass
    pass.transform(module)
    return pass.offloadedModules
}