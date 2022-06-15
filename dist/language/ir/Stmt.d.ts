import { Field } from "../../data/Field";
import { TextureBase } from "../../data/Texture";
import { PrimitiveType } from "../frontend/Type";
export declare enum StmtKind {
    ConstStmt = 0,
    RangeForStmt = 1,
    LoopIndexStmt = 2,
    AllocaStmt = 3,
    LocalLoadStmt = 4,
    LocalStoreStmt = 5,
    GlobalPtrStmt = 6,
    GlobalLoadStmt = 7,
    GlobalStoreStmt = 8,
    GlobalTemporaryStmt = 9,
    GlobalTemporaryLoadStmt = 10,
    GlobalTemporaryStoreStmt = 11,
    BinaryOpStmt = 12,
    UnaryOpStmt = 13,
    WhileStmt = 14,
    IfStmt = 15,
    WhileControlStmt = 16,
    ContinueStmt = 17,
    ArgLoadStmt = 18,
    RandStmt = 19,
    ReturnStmt = 20,
    AtomicOpStmt = 21,
    VertexForStmt = 22,
    FragmentForStmt = 23,
    VertexInputStmt = 24,
    VertexOutputStmt = 25,
    FragmentInputStmt = 26,
    BuiltInOutputStmt = 27,
    BuiltInInputStmt = 28,
    FragmentDerivativeStmt = 29,
    DiscardStmt = 30,
    TextureFunctionStmt = 31,
    CompositeExtractStmt = 32
}
export declare abstract class Stmt {
    id: number;
    returnType?: PrimitiveType | undefined;
    nameHint: string;
    constructor(id: number, returnType?: PrimitiveType | undefined, nameHint?: string);
    getName(): string;
    getReturnType(): PrimitiveType;
    operands: Stmt[];
    abstract getKind(): StmtKind;
}
export declare class ConstStmt extends Stmt {
    val: number;
    constructor(val: number, returntype: PrimitiveType, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class RangeForStmt extends Stmt {
    strictlySerialize: boolean;
    body: Block;
    constructor(range: Stmt, strictlySerialize: boolean, body: Block, id: number, nameHint?: string);
    isParallelFor: boolean;
    getRange(): Stmt;
    setRange(range: Stmt): void;
    getKind(): StmtKind;
}
export declare class LoopIndexStmt extends Stmt {
    constructor(loop: Stmt, id: number, nameHint?: string);
    getLoop(): Stmt;
    getKind(): StmtKind;
}
export declare class AllocaStmt extends Stmt {
    allocatedType: PrimitiveType;
    constructor(allocatedType: PrimitiveType, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class LocalLoadStmt extends Stmt {
    constructor(ptr: AllocaStmt, id: number, nameHint?: string);
    getPointer(): AllocaStmt;
    getKind(): StmtKind;
}
export declare class LocalStoreStmt extends Stmt {
    constructor(ptr: AllocaStmt, value: Stmt, id: number, nameHint?: string);
    getPointer(): AllocaStmt;
    getValue(): Stmt;
    getKind(): StmtKind;
}
export declare class GlobalPtrStmt extends Stmt {
    field: Field;
    indices: number[];
    offsetInElement: number;
    constructor(field: Field, indices: number[], offsetInElement: number, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class GlobalLoadStmt extends Stmt {
    ptr: GlobalPtrStmt;
    constructor(ptr: GlobalPtrStmt, id: number, nameHint?: string);
    getPointer(): GlobalPtrStmt;
    getKind(): StmtKind;
}
export declare class GlobalStoreStmt extends Stmt {
    ptr: GlobalPtrStmt;
    value: Stmt;
    constructor(ptr: GlobalPtrStmt, value: Stmt, id: number, nameHint?: string);
    getPointer(): GlobalPtrStmt;
    getValue(): Stmt;
    getKind(): StmtKind;
}
export declare class GlobalTemporaryStmt extends Stmt {
    type: PrimitiveType;
    offset: number;
    constructor(type: PrimitiveType, offset: number, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class GlobalTemporaryLoadStmt extends Stmt {
    ptr: GlobalTemporaryStmt;
    constructor(ptr: GlobalTemporaryStmt, id: number, nameHint?: string);
    getPointer(): GlobalTemporaryStmt;
    getKind(): StmtKind;
}
export declare class GlobalTemporaryStoreStmt extends Stmt {
    ptr: GlobalTemporaryStmt;
    value: Stmt;
    constructor(ptr: GlobalTemporaryStmt, value: Stmt, id: number, nameHint?: string);
    getPointer(): GlobalTemporaryStmt;
    getValue(): Stmt;
    getKind(): StmtKind;
}
export declare enum BinaryOpType {
    mul = 0,
    add = 1,
    sub = 2,
    truediv = 3,
    floordiv = 4,
    div = 5,
    mod = 6,
    max = 7,
    min = 8,
    bit_and = 9,
    bit_or = 10,
    bit_xor = 11,
    bit_shl = 12,
    bit_shr = 13,
    bit_sar = 14,
    cmp_lt = 15,
    cmp_le = 16,
    cmp_gt = 17,
    cmp_ge = 18,
    cmp_eq = 19,
    cmp_ne = 20,
    atan2 = 21,
    pow = 22,
    logical_or = 23,
    logical_and = 24
}
export declare function getBinaryOpReturnType(left: Stmt, right: Stmt, op: BinaryOpType): PrimitiveType;
export declare class BinaryOpStmt extends Stmt {
    left: Stmt;
    right: Stmt;
    op: BinaryOpType;
    constructor(left: Stmt, right: Stmt, op: BinaryOpType, id: number, nameHint?: string);
    getKind(): StmtKind;
    getLeft(): Stmt;
    getRight(): Stmt;
}
export declare enum UnaryOpType {
    neg = 0,
    sqrt = 1,
    round = 2,
    floor = 3,
    ceil = 4,
    cast_i32_value = 5,
    cast_f32_value = 6,
    cast_i32_bits = 7,
    cast_f32_bits = 8,
    abs = 9,
    sgn = 10,
    sin = 11,
    asin = 12,
    cos = 13,
    acos = 14,
    tan = 15,
    tanh = 16,
    inv = 17,
    rcp = 18,
    exp = 19,
    log = 20,
    rsqrt = 21,
    bit_not = 22,
    logic_not = 23
}
export declare function getUnaryOpReturnType(operand: Stmt, op: UnaryOpType): PrimitiveType;
export declare class UnaryOpStmt extends Stmt {
    operand: Stmt;
    op: UnaryOpType;
    constructor(operand: Stmt, op: UnaryOpType, id: number, nameHint?: string);
    getKind(): StmtKind;
    getOperand(): Stmt;
}
export declare class WhileStmt extends Stmt {
    body: Block;
    constructor(body: Block, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class IfStmt extends Stmt {
    trueBranch: Block;
    falseBranch: Block;
    constructor(cond: Stmt, trueBranch: Block, falseBranch: Block, id: number, nameHint?: string);
    getKind(): StmtKind;
    getCondition(): Stmt;
}
export declare class WhileControlStmt extends Stmt {
    constructor(id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class ContinueStmt extends Stmt {
    constructor(id: number, nameHint?: string);
    parentBlock?: Block;
    getKind(): StmtKind;
}
export declare class ArgLoadStmt extends Stmt {
    argId: number;
    constructor(argType: PrimitiveType, argId: number, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class RandStmt extends Stmt {
    constructor(type: PrimitiveType, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class ReturnStmt extends Stmt {
    constructor(values: Stmt[], id: number, nameHint?: string);
    getKind(): StmtKind;
    getValues(): Stmt[];
}
export declare enum AtomicOpType {
    add = 0,
    sub = 1,
    max = 2,
    min = 3,
    bit_and = 4,
    bit_or = 5,
    bit_xor = 6
}
export declare class AtomicOpStmt extends Stmt {
    op: AtomicOpType;
    constructor(op: AtomicOpType, dest: Stmt, operand: Stmt, id: number, nameHint?: string);
    getKind(): StmtKind;
    getDestination(): Stmt;
    getOperand(): Stmt;
}
export declare class VertexForStmt extends Stmt {
    body: Block;
    constructor(body: Block, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class FragmentForStmt extends Stmt {
    body: Block;
    constructor(body: Block, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class VertexInputStmt extends Stmt {
    location: number;
    constructor(type: PrimitiveType, location: number, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare class VertexOutputStmt extends Stmt {
    location: number;
    constructor(value: Stmt, location: number, id: number, nameHint?: string);
    getKind(): StmtKind;
    getValue(): Stmt;
}
export declare class FragmentInputStmt extends Stmt {
    location: number;
    constructor(type: PrimitiveType, location: number, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare enum BuiltInOutputKind {
    Position = 0,
    Color = 1,
    FragDepth = 2
}
export declare class BuiltInOutputStmt extends Stmt {
    builtinKind: BuiltInOutputKind;
    location: number | undefined;
    constructor(values: Stmt[], builtinKind: BuiltInOutputKind, location: number | undefined, id: number, nameHint?: string);
    getKind(): StmtKind;
    getValues(): Stmt[];
}
export declare enum BuiltInInputKind {
    VertexIndex = 0,
    InstanceIndex = 1
}
export declare function getBuiltinInputType(kind: BuiltInInputKind): PrimitiveType;
export declare class BuiltInInputStmt extends Stmt {
    builtinKind: BuiltInInputKind;
    constructor(builtinKind: BuiltInInputKind, id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare enum FragmentDerivativeDirection {
    x = 0,
    y = 1
}
export declare class FragmentDerivativeStmt extends Stmt {
    direction: FragmentDerivativeDirection;
    constructor(direction: FragmentDerivativeDirection, value: Stmt, id: number, nameHint?: string);
    getKind(): StmtKind;
    getValue(): Stmt;
}
export declare class DiscardStmt extends Stmt {
    constructor(id: number, nameHint?: string);
    getKind(): StmtKind;
}
export declare enum TextureFunctionKind {
    Sample = 0,
    SampleLod = 1,
    Load = 2,
    Store = 3
}
export declare function getTextureFunctionResultType(func: TextureFunctionKind): PrimitiveType.f32 | undefined;
export declare class TextureFunctionStmt extends Stmt {
    texture: TextureBase;
    func: TextureFunctionKind;
    constructor(texture: TextureBase, func: TextureFunctionKind, coordinates: Stmt[], additionalOperands: Stmt[], id: number, nameHint?: string);
    additionalOperandsCount: number;
    getKind(): StmtKind;
    getCoordinates(): Stmt[];
    getAdditionalOperands(): Stmt[];
}
export declare class CompositeExtractStmt extends Stmt {
    elementIndex: number;
    constructor(composite: Stmt, elementIndex: number, id: number, nameHint?: string);
    getKind(): StmtKind;
    getComposite(): Stmt;
}
export declare class Block {
    stmts: Stmt[];
    constructor(stmts?: Stmt[]);
}
export declare class IRModule {
    constructor();
    block: Block;
    idBound: number;
    getNewId(): number;
}
