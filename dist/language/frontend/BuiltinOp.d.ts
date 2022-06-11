import { Type, PrimitiveType, TypeError } from "./Type";
import { NativeTaichiAny } from "../../native/taichi/GetTaichi";
import { Value } from "./Value";
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
    forceReturnType: PrimitiveType | null;
    f: (stmt: NativeTaichiAny) => NativeTaichiAny;
    fConst: ((val: number) => number) | null;
    constructor(name: string, forceReturnType: PrimitiveType | null, f: (stmt: NativeTaichiAny) => NativeTaichiAny, fConst?: ((val: number) => number) | null);
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare enum BinaryOpDatatypeTransform {
    AlwaysF32 = 0,
    AlwaysI32 = 1,
    AlwaysVoid = 2,
    PromoteToMatch = 3,
    ForceLeft = 4
}
declare class BuiltinBinaryOp extends BuiltinOp {
    dataTypeTransform: BinaryOpDatatypeTransform;
    allowBroadcastLeftToRight: boolean;
    allowBroadcastRightToLeft: boolean;
    f: (left: NativeTaichiAny, right: NativeTaichiAny) => (NativeTaichiAny | null);
    fConst: ((left: number, right: number) => number) | null;
    constructor(name: string, dataTypeTransform: BinaryOpDatatypeTransform, allowBroadcastLeftToRight: boolean, allowBroadcastRightToLeft: boolean, f: (left: NativeTaichiAny, right: NativeTaichiAny) => (NativeTaichiAny | null), fConst?: ((left: number, right: number) => number) | null);
    checkType(args: Value[]): TypeError;
    private getResultPrimitiveType;
    private getResultType;
    apply(args: Value[]): Value;
}
declare class BuiltinCustomOp extends BuiltinOp {
    constructor(name: string, arity: number, checkType: (args: Value[]) => TypeError, apply: (args: Value[]) => Value);
    apply_: (args: Value[]) => Value;
    checkType_: (args: Value[]) => TypeError;
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinAtomicOp extends BuiltinOp {
    irBuilder: NativeTaichiAny;
    irBuilderFunc: (dest: NativeTaichiAny, val: NativeTaichiAny) => NativeTaichiAny;
    constructor(name: string, irBuilder: NativeTaichiAny, // needed for the f32 caster
    irBuilderFunc: (dest: NativeTaichiAny, val: NativeTaichiAny) => NativeTaichiAny);
    private f32Caster;
    checkType(args: Value[]): TypeError;
    apply(args: Value[]): Value;
}
declare class BuiltinOpFactory {
    static getAtomicOps(irBuilder: NativeTaichiAny): Map<string, BuiltinAtomicOp>;
    static getBuiltinOps(irBuilder: NativeTaichiAny): Map<string, BuiltinOp>;
}
export { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory };
