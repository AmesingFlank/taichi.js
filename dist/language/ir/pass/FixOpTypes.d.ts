import { BinaryOpStmt, IRModule } from '../Stmt';
import { IRTransformer } from '../Transformer';
declare class FixOpTypesPass extends IRTransformer {
    visitBinaryOpStmt(stmt: BinaryOpStmt): void;
}
export declare function fixOpTypes(module: IRModule): FixOpTypesPass;
export {};
