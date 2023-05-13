import { IRModule, Stmt } from '../Stmt'
import { IRTransformer } from '../Transformer'

class RemapIdsPass extends IRTransformer {
    override transform(module: IRModule): void {
        super.transform(module)
        module.idBound = this.idBound
    }
    override pushNewStmt(stmt: Stmt): Stmt {
        stmt.id = this.getNewId()
        return super.pushNewStmt(stmt)
    }
    idBound: number = 0
    getNewId() {
        return this.idBound++
    }
}

export function remapIds(module: IRModule) {
    new RemapIdsPass().transform(module)
}
