import { Stmt } from "../Stmt";
import { IRTransformer } from "../Transformer";
export declare class DelayedStmtReplacer extends IRTransformer {
    replaceMap: Map<Stmt, Stmt>;
    markReplace(a: Stmt, b: Stmt): void;
    pushNewStmt(stmt: Stmt): Stmt;
}
