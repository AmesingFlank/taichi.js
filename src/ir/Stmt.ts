import { Field } from "../data/Field"
import { TextureBase } from "../data/Texture"
import { PrimitiveType } from "../frontend/Type"
import { assert } from "../utils/Logging"

// designed to have the same API as native taichi's IR 
// which is why there're some camel_case and camelCase mash-ups


export enum StmtKind {
    ConstStmt,
    RangeForStmt,
    LoopIndexStmt,
    AllocaStmt,
    LocalLoadStmt,
    LocalStoreStmt,
    GlobalPtrStmt,
    GlobalLoadStmt,
    GlobalStoreStmt,
    BinaryOpStmt,
    UnaryOpStmt,
    WhileStmt,
    IfStmt,
    WhileControlStmt,
    ContinueStmt,
    ArgLoadStmt,
    RandStmt,
    ReturnStmt,
    AtomicOpStmt,

    VertexForStmt,
    FragmentForStmt,
    VertexInputStmt,
    VertexOutputStmt,
    FragmentInputStmt,
    BuiltInOutputStmt,
    BuiltInInputStmt,
    FragmentDerivativeStmt,
    DiscardStmt,
    TextureFunctionStmt,
    CompositeExtractStmt,
}

export abstract class Stmt {
    constructor(
        public id: number,
        public returnType?: PrimitiveType,
        public nameHint: string = ""
    ) {

    }

    getName() {
        return `_${this.id}_${this.nameHint}`
    }

    abstract getKind(): StmtKind;
}

export class ConstStmt extends Stmt {
    constructor(
        public val: number,
        returntype: PrimitiveType,
        id: number,
        nameHint: string = ""
    ) {
        super(id, returntype, nameHint)
    }

    override getKind(): StmtKind {
        return StmtKind.ConstStmt
    }
}

export class RangeForStmt extends Stmt {
    constructor(
        public range: Stmt,
        public strictlySerialize: boolean,
        public body: Block,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.RangeForStmt
    }
}

export class LoopIndexStmt extends Stmt {
    constructor(
        public loop: Stmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, PrimitiveType.i32, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.LoopIndexStmt
    }
}

export class AllocaStmt extends Stmt {
    constructor(
        public allocatedType: PrimitiveType,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.AllocaStmt
    }
}

export class LocalLoadStmt extends Stmt {
    constructor(
        public ptr: AllocaStmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, ptr.allocatedType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.LocalLoadStmt
    }
}

export class LocalStoreStmt extends Stmt {
    constructor(
        public ptr: AllocaStmt,
        public value: Stmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.LocalStoreStmt
    }
}

export class GlobalPtrStmt extends Stmt {
    constructor(
        public field: Field,
        public indices: number[],
        public offsetInElement: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.GlobalPtrStmt
    }
}


export class GlobalLoadStmt extends Stmt {
    constructor(
        public ptr: GlobalPtrStmt,
        id: number,
        nameHint: string = ""
    ) {
        let returnType = ptr.field.elementType.getPrimitivesList()[ptr.offsetInElement]
        super(id, returnType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.GlobalLoadStmt
    }
}

export class GlobalStoreStmt extends Stmt {
    constructor(
        public ptr: GlobalPtrStmt,
        public value: Stmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.GlobalStoreStmt
    }
}

export enum BinaryOpType {
    mul,
    add,
    sub,
    truediv,
    floordiv,
    div,
    mod,
    max,
    min,
    bit_and,
    bit_or,
    bit_xor,
    bit_shl,
    bit_shr,
    bit_sar,
    cmp_lt,
    cmp_le,
    cmp_gt,
    cmp_ge,
    cmp_eq,
    cmp_ne,
    atan2,
    pow,
    logical_or,
    logical_and,
}

export function getBinaryOpReturnType(left: Stmt, right: Stmt, op: BinaryOpType): PrimitiveType {
    assert(left.returnType !== undefined && right.returnType !== undefined, "LHS and RHS of binary op must both have a valid return type")
    let leftType = left.returnType!
    let rightType = right.returnType!

    switch (op) {
        case BinaryOpType.cmp_eq:
        case BinaryOpType.cmp_ge:
        case BinaryOpType.cmp_gt:
        case BinaryOpType.cmp_le:
        case BinaryOpType.cmp_lt:
        case BinaryOpType.cmp_ne:
            return PrimitiveType.i32
        case BinaryOpType.logical_and:
        case BinaryOpType.logical_or:
        case BinaryOpType.bit_and:
        case BinaryOpType.bit_or:
        case BinaryOpType.bit_xor:
        case BinaryOpType.bit_shl:
        case BinaryOpType.bit_sar:
        case BinaryOpType.bit_shr: {
            assert(leftType === PrimitiveType.i32 && rightType === PrimitiveType.i32, "bit ops can only be applied to ints")
            return PrimitiveType.i32
        }
        case BinaryOpType.truediv:
            return PrimitiveType.f32
        case BinaryOpType.floordiv:
            return PrimitiveType.i32
        default: {
            if (leftType == rightType) {
                return leftType
            }
            return PrimitiveType.f32
        }
    }
}

export class BinaryOpStmt extends Stmt {
    constructor(
        public left: Stmt,
        public right: Stmt,
        public op: BinaryOpType,
        id: number,
        nameHint: string = ""
    ) {
        let returnType = getBinaryOpReturnType(left, right, op)
        super(id, returnType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.BinaryOpStmt
    }
}

export enum UnaryOpType {
    neg,
    sqrt,
    round,
    floor,
    ceil,
    cast_i32_value,
    cast_f32_value,
    cast_i32_bits,
    cast_f32_bits,
    abs,
    sgn,
    sin,
    asin,
    cos,
    acos,
    tan,
    tanh,
    inv,
    rcp,
    exp,
    log,
    rsqrt,
    bit_not,
    logic_not,
}

export function getUnaryOpReturnType(operand: Stmt, op: UnaryOpType): PrimitiveType {
    assert(operand.returnType !== undefined, "operand of unary op must both have a valid return type")
    switch (op) {
        case UnaryOpType.round:
        case UnaryOpType.floor:
        case UnaryOpType.ceil:
            return PrimitiveType.i32
        case UnaryOpType.cast_i32_value:
        case UnaryOpType.cast_i32_bits:
            return PrimitiveType.i32
        case UnaryOpType.cast_f32_value:
        case UnaryOpType.cast_f32_bits:
            return PrimitiveType.i32
        case UnaryOpType.sgn:
            return PrimitiveType.i32
        case UnaryOpType.bit_not:
        case UnaryOpType.logic_not:
            assert(operand.returnType === PrimitiveType.i32, "bit_not can only be applied to ints")
            return PrimitiveType.i32
        case UnaryOpType.abs:
        case UnaryOpType.neg:
            return operand.returnType!
        default:
            return PrimitiveType.f32
    }
}

export class UnaryOpStmt extends Stmt {
    constructor(
        public operand: Stmt,
        public op: UnaryOpType,
        id: number,
        nameHint: string = ""
    ) {
        let returnType = getUnaryOpReturnType(operand, op)
        super(id, returnType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.UnaryOpStmt
    }
}

export class WhileStmt extends Stmt {
    constructor(
        public body: Block,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.WhileStmt
    }
}

export class IfStmt extends Stmt {
    constructor(
        public cond: Stmt,
        public trueBranch: Block,
        public falseBranch: Block,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.IfStmt
    }
}

export class WhileControlStmt extends Stmt {
    constructor(
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.WhileControlStmt
    }
}

export class ContinueStmt extends Stmt {
    constructor(
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.ContinueStmt
    }
}

export class ArgLoadStmt extends Stmt {
    constructor(
        argType: PrimitiveType,
        public argId: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, argType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.ArgLoadStmt
    }
}

export class RandStmt extends Stmt {
    constructor(
        type: PrimitiveType,
        id: number,
        nameHint: string = ""
    ) {
        super(id, type, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.RandStmt
    }
}

export class ReturnStmt extends Stmt {
    constructor(
        public values: Stmt[],
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.ReturnStmt
    }
}

export enum AtomicOpType {
    add, sub, max, min, bit_and, bit_or, bit_xor
}

export class AtomicOpStmt extends Stmt {
    constructor(
        public op: AtomicOpType,
        public dest: Stmt,
        public val: Stmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, val.returnType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.AtomicOpStmt
    }
}

export class VertexForStmt extends Stmt {
    constructor(
        public body: Block,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.VertexForStmt
    }
}

export class FragmentForStmt extends Stmt {
    constructor(
        public body: Block,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.FragmentForStmt
    }
}

export class VertexInputStmt extends Stmt {
    constructor(
        type: PrimitiveType,
        public location: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, type, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.VertexInputStmt
    }
}

export class VertexOutputStmt extends Stmt {
    constructor(
        public value: Stmt,
        public location: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.VertexOutputStmt
    }
}

export class FragmentInputStmt extends Stmt {
    constructor(
        type: PrimitiveType,
        public location: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, type, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.FragmentInputStmt
    }
}

export enum BuiltInOutputKind {
    Position,
    Color,
    FragDepth
}

export class BuiltInOutputStmt extends Stmt {
    constructor(
        public values: Stmt[],
        public kind: BuiltInOutputKind,
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.BuiltInOutputStmt
    }
}

export enum BuiltinInputKind {
    VertexIndex = 0, InstanceIndex = 1,
}

export function getBuiltinInputType(kind: BuiltinInputKind) {
    switch (kind) {
        case BuiltinInputKind.VertexIndex:
        case BuiltinInputKind.InstanceIndex:
            return PrimitiveType.i32
    }
}

export class BuiltInInputStmt extends Stmt {
    constructor(
        public kind: BuiltinInputKind,
        id: number,
        nameHint: string = ""
    ) {

        super(id, getBuiltinInputType(kind), nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.BuiltInInputStmt
    }
}

export enum FragmentDerivativeDirection { x, y }

export class FragmentDerivativeStmt extends Stmt {
    constructor(
        public value: Stmt,
        id: number,
        nameHint: string = ""
    ) {
        super(id, PrimitiveType.f32, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.FragmentDerivativeStmt
    }
}

export class DiscardStmt extends Stmt {
    constructor(
        id: number,
        nameHint: string = ""
    ) {
        super(id, undefined, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.DiscardStmt
    }
}

export enum TextureFunctionKind {
    Sample,
    SampleLod,
    Load,
    Store
}

export function getTextureFunctionResultType(func: TextureFunctionKind) {
    switch (func) {
        case TextureFunctionKind.Load:
        case TextureFunctionKind.SampleLod:
        case TextureFunctionKind.Sample:
            return PrimitiveType.f32
        case TextureFunctionKind.Store:
            return undefined
    }
}

export class TextureFunctionStmt extends Stmt {
    constructor(
        public texture: TextureBase,
        public func: TextureFunctionKind,
        public coordinates: Stmt[],
        public operands: Stmt[],
        id: number,
        nameHint: string = ""
    ) {
        super(id, getTextureFunctionResultType(func), nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.TextureFunctionStmt
    }
}

export class CompositeExtractStmt extends Stmt {
    constructor(
        public composite: Stmt,
        public elementIndex: number,
        id: number,
        nameHint: string = ""
    ) {
        super(id, composite.returnType, nameHint)
    }
    override getKind(): StmtKind {
        return StmtKind.CompositeExtractStmt
    }
}


export class Block {
    constructor(public stmts: Stmt[] = []) {

    }
}