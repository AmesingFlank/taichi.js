import { Type, TypeError } from "./Type";
import { Value } from "./Value";
import { AtomicOpType, BinaryOpType, UnaryOpType } from "../ir/Stmt";
import { IRBuilder } from "../ir/Builder";
declare class BuiltinOp {
    name: string;
    arity: number;
    constructor(name: string, arity: number);
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinNullaryOp extends BuiltinOp {
    resultType: Type;
    func: () => Value;
    constructor(name: string, resultType: Type, func: () => Value);
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinUnaryOp extends BuiltinOp {
    irBuilder: IRBuilder;
    op: UnaryOpType;
    fConst: ((val: number) => number) | null;
    constructor(name: string, irBuilder: IRBuilder, op: UnaryOpType, fConst?: ((val: number) => number) | null);
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinBinaryOp extends BuiltinOp {
    irBuilder: IRBuilder;
    allowBroadcastLeftToRight: boolean;
    allowBroadcastRightToLeft: boolean;
    op: BinaryOpType;
    fConst: ((left: number, right: number) => number) | null;
    constructor(name: string, irBuilder: IRBuilder, allowBroadcastLeftToRight: boolean, allowBroadcastRightToLeft: boolean, op: BinaryOpType, fConst?: ((left: number, right: number) => number) | null);
    checkType(args: Value[]): TypeError;
    private getResultType;
    apply(args: Value[]): Value;
}
declare class BuiltinCustomOp extends BuiltinOp {
    constructor(name: string, arity: number, checkType: (args: Value[]) => TypeError, apply: (args: Value[]) => Value);
    private apply_;
    private checkType_;
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinAtomicOp extends BuiltinOp {
    irBuilder: IRBuilder;
    op: AtomicOpType;
    constructor(name: string, irBuilder: IRBuilder, op: AtomicOpType);
    private f32Caster;
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinOpFactory {
    static getAtomicOps(irBuilder: IRBuilder): Map<string, BuiltinAtomicOp>;
    static getBuiltinOps(irBuilder: IRBuilder): Map<string, BuiltinOp>;
}
export { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory };
