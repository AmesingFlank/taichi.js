import {
    Type,
    TypeCategory,
    ScalarType,
    VectorType,
    MatrixType,
    PointerType,
    VoidType,
    TypeUtils,
    PrimitiveType,
    TypeError,
    StructType,
} from './Type'
import { assert, error } from '../../utils/Logging'
import { Value, ValueUtils } from './Value'
import {
    AllocaStmt,
    AtomicOpType,
    BinaryOpType,
    getBinaryOpReturnType,
    getUnaryOpReturnType,
    GlobalPtrStmt,
    GlobalTemporaryStmt,
    PointerStmt,
    Stmt,
    StmtKind,
    UnaryOpType,
} from '../ir/Stmt'
import { IRBuilder } from '../ir/Builder'

class BuiltinOp {
    constructor(public name: string, public arity: number) {}

    checkType(args: Value[]): TypeError {
        return TypeError.createError('calling checkType from BuiltinOp base')
    }

    apply(args: Value[]): Value {
        error('calling apply from BuiltinOp base')
        return args[0]
    }
}

class BuiltinNullaryOp extends BuiltinOp {
    constructor(name: string, public resultType: Type, public func: () => Value) {
        super(name, 0)
    }

    override checkType(args: Value[]): TypeError {
        if (args.length === 0) {
            return TypeError.createNoError()
        }
        return TypeError.createError('wrong number of arguments, expecting 0, got ' + args.length.toString())
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, '[Compiler Bug]', 'nullary op type check failed', typeError.msg)
        return this.func()
    }
}

class BuiltinUnaryOp extends BuiltinOp {
    constructor(
        name: string,
        public irBuilder: IRBuilder,
        public op: UnaryOpType,
        public fConst: ((val: number) => number) | null = null
    ) {
        super(name, 1)
    }

    override checkType(args: Value[]): TypeError {
        if (args.length !== 1) {
            return TypeError.createError('wrong number of arguments')
        }
        if (!TypeUtils.isTensorType(args[0].getType())) {
            return TypeError.createError('can only be applied to scalar/vector/matrix types')
        }
        let prim = TypeUtils.getPrimitiveType(args[0].getType())
        let resultPrim = getUnaryOpReturnType(prim, this.op)
        if (!resultPrim) {
            return TypeError.createError(
                `unary op "${this.name}" cannot be applied to an operand of primitive type ${prim}`
            )
        }
        return TypeError.createNoError()
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, '[Compiler Bug]', 'unary op type check failed', typeError.msg)
        let arg = args[0]

        let prim = TypeUtils.getPrimitiveType(args[0].getType())
        let resultPrim = getUnaryOpReturnType(prim, this.op)
        if (!resultPrim) {
            error('[Compiler bug]', `unary op "${this.name}" cannot be applied to an operand of primitive type ${prim}`)
        }

        let returnType = TypeUtils.replacePrimitiveType(arg.getType(), resultPrim!)

        let result = new Value(returnType, [], [])
        for (let i = 0; i < arg.stmts.length; ++i) {
            result.stmts.push(this.irBuilder.create_unary_op(arg.stmts[i], this.op))
            if (this.fConst && arg.isCompileTimeConstant()) {
                result.compileTimeConstants.push(this.fConst(arg.compileTimeConstants[i]))
            }
        }
        return result
    }
}

class BuiltinBinaryOp extends BuiltinOp {
    constructor(
        name: string,
        public irBuilder: IRBuilder,
        public allowBroadcastLeftToRight: boolean,
        public allowBroadcastRightToLeft: boolean,
        public op: BinaryOpType,
        public fConst: ((left: number, right: number) => number) | null = null
    ) {
        super(name, 2)
    }

    override checkType(args: Value[]): TypeError {
        if (args.length !== 2) {
            return TypeError.createError('wrong number of arguments')
        }
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()

        if (!TypeUtils.isTensorType(type0)) {
            return TypeError.createError('can only be applied to scalar/vector/matrix types')
        }
        if (!TypeUtils.isTensorType(type1)) {
            return TypeError.createError('can only be applied to scalar/vector/matrix types')
        }

        let prim0 = TypeUtils.getPrimitiveType(type0)
        let prim1 = TypeUtils.getPrimitiveType(type1)

        let resultPrim = getBinaryOpReturnType(prim0, prim1, this.op)
        if (!resultPrim) {
            return TypeError.createError(
                `binary op "${this.name}" cannot be applied when LHS primitive type is ${prim0} and RHS primitive type is ${prim1}`
            )
        }

        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar) {
                if (this.allowBroadcastLeftToRight) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('Broadcast (left to right) not allowed')
                }
            } else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar) {
                if (this.allowBroadcastRightToLeft) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('Broadcast (right to left) not allowed')
                }
            }
            return TypeError.createError('Incompatible types')
        } else {
            // cat0 === cat1
            if (cat0 === TypeCategory.Scalar) {
                return TypeError.createNoError()
            } else if (cat0 === TypeCategory.Vector) {
                let numRows0 = (type0 as VectorType).getNumRows()
                let numRows1 = (type1 as VectorType).getNumRows()
                if (numRows0 === numRows1) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError(
                        `numRows mismatch during vector-vector binary op: LHS num rows is ${numRows0}, but RHS num rows is ${numRows1}`
                    )
                }
            } else if (cat0 === TypeCategory.Matrix) {
                let mat0 = type0 as MatrixType
                let mat1 = type1 as MatrixType
                if (mat0.getNumRows() === mat0.getNumRows() && mat1.getNumCols() === mat1.getNumCols()) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError(
                        `matrix shape mismatch during matrix-matrix binary op: LHS is a ${mat0.getNumRows()} by ${mat0.getNumRows()} matrix, but RHS is a ${mat1.getNumRows()} by ${mat1.getNumRows()} matrix.`
                    )
                }
            }
            error('[Compiler Bug]', 'cat0 is not tensor type')
            return TypeError.createError('[Compiler Bug] cat0 is not tensor type')
        }
    }

    private getResultType(type0: Type, type1: Type) {
        // assuming checkType
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()
        let prim0 = TypeUtils.getPrimitiveType(type0)
        let prim1 = TypeUtils.getPrimitiveType(type1)
        let resultPrim = getBinaryOpReturnType(prim0, prim1, this.op)
        if (resultPrim === undefined) {
            error('[Compiler Bug]', 'unsupported primitives in binary op')
        }

        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar && this.allowBroadcastLeftToRight) {
                return TypeUtils.replacePrimitiveType(type1, resultPrim!)
            } else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar && this.allowBroadcastRightToLeft) {
                return TypeUtils.replacePrimitiveType(type0, resultPrim!)
            }
            error('[Compiler Bug]', 'bad broadcase')
            return type0
        } else {
            // cat0 === cat1
            return TypeUtils.replacePrimitiveType(type0, resultPrim!)
        }
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, '[Compiler Bug]', 'binary op type check failed', typeError.msg)
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()

        let resultType = this.getResultType(type0, type1)
        let result = new Value(resultType, [], [])

        let shouldEvaluateConstexpr =
            args[0].isCompileTimeConstant() && args[1].isCompileTimeConstant() && this.fConst !== null

        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar && this.allowBroadcastLeftToRight) {
                for (let i = 0; i < args[1].stmts.length; ++i) {
                    result.stmts.push(this.irBuilder.create_binary_op(args[0].stmts[0], args[1].stmts[i], this.op))
                    if (shouldEvaluateConstexpr) {
                        result.compileTimeConstants.push(
                            this.fConst!(args[0].compileTimeConstants[0], args[1].compileTimeConstants[i])
                        )
                    }
                }
            } else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar && this.allowBroadcastRightToLeft) {
                for (let i = 0; i < args[0].stmts.length; ++i) {
                    result.stmts.push(this.irBuilder.create_binary_op(args[0].stmts[i], args[1].stmts[0], this.op))
                    if (shouldEvaluateConstexpr) {
                        result.compileTimeConstants.push(
                            this.fConst!(args[0].compileTimeConstants[i], args[1].compileTimeConstants[0])
                        )
                    }
                }
            }
        } else {
            // cat0 === cat1
            for (let i = 0; i < args[0].stmts.length; ++i) {
                result.stmts.push(this.irBuilder.create_binary_op(args[0].stmts[i], args[1].stmts[i], this.op))
                if (shouldEvaluateConstexpr) {
                    result.compileTimeConstants.push(
                        this.fConst!(args[0].compileTimeConstants[i], args[1].compileTimeConstants[i])
                    )
                }
            }
        }

        return result
    }
}

class BuiltinCustomOp extends BuiltinOp {
    constructor(name: string, arity: number, checkType: (args: Value[]) => TypeError, apply: (args: Value[]) => Value) {
        super(name, arity)
        this.apply_ = apply
        this.checkType_ = checkType
    }

    private apply_: (args: Value[]) => Value
    private checkType_: (args: Value[]) => TypeError

    override checkType(args: Value[]): TypeError {
        return this.checkType_(args)
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, '[Compiler Bug]', 'custom op type check failed', typeError.msg)
        return this.apply_(args)
    }
}

class BuiltinAtomicOp extends BuiltinOp {
    constructor(name: string, public irBuilder: IRBuilder, public op: AtomicOpType) {
        super(name, 2)
        this.f32Caster = new BuiltinUnaryOp('f32', irBuilder, UnaryOpType.cast_f32_value)
    }

    private f32Caster: BuiltinUnaryOp

    override checkType(args: Value[]): TypeError {
        if (args.length !== 2) {
            return TypeError.createError('atomic op must be of the form ti.atomicXX(dest,val) or dest op= val')
        }
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        if (cat0 !== TypeCategory.Pointer) {
            return TypeError.createError('destination of atomic operation must be an lvalue')
        }
        let pointerType = type0 as PointerType
        if (!TypeUtils.isTensorType(pointerType.getValueType())) {
            return TypeError.createError('destination of atomic operation must be a scalar, vector, or a matrix')
        }
        if (!TypeUtils.isTensorType(type1)) {
            return TypeError.createError('operand of atomic operation must be a scalar, vector, or a matrix')
        }
        let prim0 = TypeUtils.getPrimitiveType(pointerType.getValueType())
        let prim1 = TypeUtils.getPrimitiveType(type1)
        if (prim0 === PrimitiveType.i32 && prim1 === PrimitiveType.f32) {
            return TypeError.createError('Atomic op type error: destination is i32 but operand is f32')
        }
        if (
            prim0 === PrimitiveType.f32 &&
            [AtomicOpType.bit_and, AtomicOpType.bit_or, AtomicOpType.bit_and].includes(this.op)
        ) {
            return TypeError.createError('Bit-wise atomic op cannot be applied to a f32 destination')
        }
        if (!pointerType.getValueType().equals(TypeUtils.replacePrimitiveType(type1, prim0))) {
            return TypeError.createError('Mismatch between operand and destination shape (broadcasting not allowed)')
        }
        return TypeError.createNoError()
    }

    apply(args: Value[]): Value {
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let pointerType = type0 as PointerType
        let destValueType = pointerType.getValueType()
        let prim0 = TypeUtils.getPrimitiveType(destValueType)
        let prim1 = TypeUtils.getPrimitiveType(type1)
        if (prim0 === PrimitiveType.f32 && prim1 === PrimitiveType.i32) {
            // float += int
            args[1] = this.f32Caster.apply([args[1]])
        }
        let result = new Value(destValueType, [], [])
        for (let i = 0; i < args[0].stmts.length; ++i) {
            result.stmts.push(
                this.irBuilder.create_atomic_op(args[0].stmts[i] as PointerStmt, args[1].stmts[i], this.op)
            )
        }
        return result
    }
}

class BuiltinOpFactory {
    static getAtomicOps(irBuilder: IRBuilder): Map<string, BuiltinAtomicOp> {
        let opsMap = new Map<string, BuiltinAtomicOp>()
        let ops: BuiltinAtomicOp[] = [
            new BuiltinAtomicOp('atomicAdd', irBuilder, AtomicOpType.add),
            new BuiltinAtomicOp('atomicSub', irBuilder, AtomicOpType.sub),
            new BuiltinAtomicOp('atomicMax', irBuilder, AtomicOpType.max),
            new BuiltinAtomicOp('atomicMin', irBuilder, AtomicOpType.min),
            new BuiltinAtomicOp('atomicAnd', irBuilder, AtomicOpType.bit_and),
            new BuiltinAtomicOp('atomicOr', irBuilder, AtomicOpType.bit_or),
            new BuiltinAtomicOp('atomicXor', irBuilder, AtomicOpType.bit_xor),
        ]
        for (let op of ops) {
            opsMap.set(op.name, op)
        }
        return opsMap
    }

    static getBuiltinOps(irBuilder: IRBuilder): Map<string, BuiltinOp> {
        let opsMap = new Map<string, BuiltinOp>()
        let ops: BuiltinOp[] = [
            new BuiltinBinaryOp('+', irBuilder, true, true, BinaryOpType.add, (l, r) => l + r),
            new BuiltinBinaryOp('add', irBuilder, true, true, BinaryOpType.add, (l, r) => l + r),
            new BuiltinBinaryOp('-', irBuilder, true, true, BinaryOpType.sub, (l, r) => l - r),
            new BuiltinBinaryOp('sub', irBuilder, true, true, BinaryOpType.sub, (l, r) => l - r),
            new BuiltinBinaryOp('*', irBuilder, true, true, BinaryOpType.mul, (l, r) => l - r),
            new BuiltinBinaryOp('mul', irBuilder, true, true, BinaryOpType.sub, (l, r) => l - r),
            new BuiltinBinaryOp('**', irBuilder, true, true, BinaryOpType.pow, (l, r) => Math.pow(l, r)),
            new BuiltinBinaryOp('%', irBuilder, true, true, BinaryOpType.mod, (l, r) => l % r),
            new BuiltinBinaryOp('<', irBuilder, true, true, BinaryOpType.cmp_lt, (l, r) => Number(l < r)),
            new BuiltinBinaryOp('<=', irBuilder, true, true, BinaryOpType.cmp_le, (l, r) => Number(l <= r)),
            new BuiltinBinaryOp('>', irBuilder, true, true, BinaryOpType.cmp_gt, (l, r) => Number(l > r)),
            new BuiltinBinaryOp('>=', irBuilder, true, true, BinaryOpType.cmp_ge, (l, r) => Number(l >= r)),
            new BuiltinBinaryOp('==', irBuilder, true, true, BinaryOpType.cmp_eq, (l, r) => Number(l === r)),
            new BuiltinBinaryOp('!=', irBuilder, true, true, BinaryOpType.cmp_ne, (l, r) => Number(l !== r)),
            new BuiltinBinaryOp('===', irBuilder, true, true, BinaryOpType.cmp_eq, (l, r) => Number(l === r)),
            new BuiltinBinaryOp('!==', irBuilder, true, true, BinaryOpType.cmp_ne, (l, r) => Number(l !== r)),
            new BuiltinBinaryOp('&', irBuilder, true, true, BinaryOpType.bit_and, (l, r) => l & r),
            new BuiltinBinaryOp('&&', irBuilder, false, false, BinaryOpType.bit_and, (l, r) => l & r),
            new BuiltinBinaryOp('|', irBuilder, true, true, BinaryOpType.bit_or, (l, r) => l & r),
            new BuiltinBinaryOp('||', irBuilder, false, false, BinaryOpType.bit_or, (l, r) => l & r),
            new BuiltinBinaryOp('^', irBuilder, true, true, BinaryOpType.bit_xor, (l, r) => l & r),

            new BuiltinBinaryOp('/', irBuilder, true, true, BinaryOpType.truediv, (l, r) => l / r),
            new BuiltinBinaryOp('div', irBuilder, true, true, BinaryOpType.truediv, (l, r) => l / r),

            // doesn't work
            new BuiltinBinaryOp('<<', irBuilder, false, false, BinaryOpType.bit_shl),
            new BuiltinBinaryOp('>>>', irBuilder, false, false, BinaryOpType.bit_shr),

            new BuiltinBinaryOp('max', irBuilder, true, true, BinaryOpType.max, (l, r) => Math.max(l, r)),
            new BuiltinBinaryOp('min', irBuilder, true, true, BinaryOpType.min, (l, r) => Math.min(l, r)),
            new BuiltinBinaryOp('pow', irBuilder, true, true, BinaryOpType.pow, (l, r) => Math.pow(l, r)),
            new BuiltinBinaryOp('atan2', irBuilder, true, true, BinaryOpType.atan2, (l, r) => Math.atan2(l, r)),

            new BuiltinUnaryOp('sin', irBuilder, UnaryOpType.sin),
            new BuiltinUnaryOp('cos', irBuilder, UnaryOpType.cos),
            new BuiltinUnaryOp('asin', irBuilder, UnaryOpType.asin),
            new BuiltinUnaryOp('acos', irBuilder, UnaryOpType.acos),
            new BuiltinUnaryOp('tan', irBuilder, UnaryOpType.tan),
            new BuiltinUnaryOp('tanh', irBuilder, UnaryOpType.tanh),
            new BuiltinUnaryOp('exp', irBuilder, UnaryOpType.exp),
            new BuiltinUnaryOp('log', irBuilder, UnaryOpType.log),
            new BuiltinUnaryOp('neg', irBuilder, UnaryOpType.neg, (x) => -x),
            new BuiltinUnaryOp('not', irBuilder, UnaryOpType.bit_not),
            new BuiltinUnaryOp('logical_not', irBuilder, UnaryOpType.logic_not),
            new BuiltinUnaryOp('abs', irBuilder, UnaryOpType.abs),
            new BuiltinUnaryOp('floor', irBuilder, UnaryOpType.floor),
            new BuiltinUnaryOp('sgn', irBuilder, UnaryOpType.sgn),
            new BuiltinUnaryOp('sqrt', irBuilder, UnaryOpType.sqrt),
            new BuiltinUnaryOp('rsqrt', irBuilder, UnaryOpType.rsqrt),

            new BuiltinUnaryOp('i32', irBuilder, UnaryOpType.cast_i32_value, (x) => Math.floor(x)),
            new BuiltinUnaryOp('f32', irBuilder, UnaryOpType.cast_f32_value, (x) => x),
            new BuiltinUnaryOp('bitcast_f32', irBuilder, UnaryOpType.cast_f32_bits, (x) => x),
            new BuiltinUnaryOp('bitcast_i32', irBuilder, UnaryOpType.cast_i32_bits, (x) => x),

            new BuiltinNullaryOp(
                'random',
                new ScalarType(PrimitiveType.f32),
                () => new Value(new ScalarType(PrimitiveType.f32), [irBuilder.create_rand(PrimitiveType.f32)], [])
            ),
        ]
        for (let op of ops) {
            opsMap.set(op.name, op)
        }

        let store = new BuiltinCustomOp(
            '=',
            2,
            (args: Value[]): TypeError => {
                if (args.length !== 2) {
                    return TypeError.createError('what??')
                }
                if (args[0].getType().getCategory() !== TypeCategory.Pointer) {
                    return TypeError.createError('expecting left hand side of assignment to be an lvalue')
                }
                let pointerType = args[0].getType() as PointerType
                let type1 = args[1].getType()
                if (TypeUtils.isTensorType(pointerType.getValueType()) && TypeUtils.isTensorType(type1)) {
                    let destPrim = TypeUtils.getPrimitiveType(pointerType.getValueType())
                    let valPrim = TypeUtils.getPrimitiveType(type1)
                    if (destPrim === PrimitiveType.i32 && valPrim === PrimitiveType.f32) {
                        // in Python taichi, this will cause native taichi to trigger a warning.
                        // instead, taichi.js directy throws an error.
                        return TypeError.createError('storing f32 into a i32 local variable.')
                    }
                    if (TypeUtils.tensorTypeShapeMatch(pointerType.getValueType(), type1)) {
                        return TypeError.createNoError()
                    }
                    if (type1.getCategory() === TypeCategory.Scalar) {
                        // broadcast right to left
                        return TypeError.createNoError()
                    }
                    return TypeError.createError('Shape mismatch in assignment')
                } else if (
                    pointerType.getValueType().getCategory() === TypeCategory.Struct &&
                    type1.getCategory() === TypeCategory.Struct
                ) {
                    if (!pointerType.getValueType().equals(type1)) {
                        TypeError.createError('struct type mismatch')
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError('invalid assignment')
            },
            (args: Value[]): Value => {
                let pointerType = args[0].getType() as PointerType
                let type1 = args[1].getType()
                let storeFunc = (ptr: Stmt, value: Stmt) => {
                    switch (ptr.getKind()) {
                        case StmtKind.GlobalPtrStmt: {
                            return irBuilder.create_global_store(ptr as GlobalPtrStmt, value)
                        }
                        case StmtKind.GlobalTemporaryStmt: {
                            return irBuilder.create_global_temporary_store(ptr as GlobalTemporaryStmt, value)
                        }
                        case StmtKind.AllocaStmt: {
                            return irBuilder.create_local_store(ptr as AllocaStmt, value)
                        }
                        default: {
                            error('assignment failed: not a pointer', args)
                        }
                    }
                }

                if (TypeUtils.isTensorType(pointerType.getValueType()) && TypeUtils.isTensorType(args[1].getType())) {
                    let destPrim = TypeUtils.getPrimitiveType(pointerType.getValueType())
                    let valPrim = TypeUtils.getPrimitiveType(type1)
                    if (destPrim === PrimitiveType.f32 && valPrim === PrimitiveType.i32) {
                        args[1] = opsMap.get('f32')!.apply([args[1]])
                    }
                    if (TypeUtils.tensorTypeShapeMatch(pointerType.getValueType(), type1)) {
                        assert(
                            args[0].stmts.length === args[1].stmts.length,
                            '[Compiler bug]',
                            'Expecting stmts.length to match'
                        )
                        for (let i = 0; i < args[0].stmts.length; ++i) {
                            storeFunc(args[0].stmts[i], args[1].stmts[i])
                        }
                    } else if (type1.getCategory() === TypeCategory.Scalar) {
                        // broadcast right to left
                        for (let i = 0; i < args[0].stmts.length; ++i) {
                            storeFunc(args[0].stmts[i], args[1].stmts[0])
                        }
                    } else {
                        error('[Compiler bug]', 'Shape mismatch in assignment')
                    }
                } else if (
                    pointerType.getValueType().getCategory() === TypeCategory.Struct &&
                    type1.getCategory() === TypeCategory.Struct
                ) {
                    for (let i = 0; i < args[0].stmts.length; ++i) {
                        storeFunc(args[0].stmts[i], args[1].stmts[i])
                    }
                } else {
                    error('[Compiler bug]', 'invalid assignemnt')
                }
                return new Value(new VoidType(), [], [])
            }
        )

        let load = new BuiltinCustomOp(
            'load',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Pointer) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting pointer type')
                }
            },
            (args: Value[]) => {
                let pointerType = args[0].getType() as PointerType
                let resultType = pointerType.getValueType()
                let result = new Value(resultType, [])
                for (let i = 0; i < args[0].stmts.length; ++i) {
                    let ptr = args[0].stmts[i]
                    switch (ptr.getKind()) {
                        case StmtKind.GlobalPtrStmt: {
                            result.stmts.push(irBuilder.create_global_load(ptr as GlobalPtrStmt))
                            break
                        }
                        case StmtKind.GlobalTemporaryStmt: {
                            result.stmts.push(irBuilder.create_global_temporary_load(ptr as GlobalTemporaryStmt))
                            break
                        }
                        case StmtKind.AllocaStmt: {
                            result.stmts.push(irBuilder.create_local_load(ptr as AllocaStmt))
                            break
                        }
                        default: {
                            error('load failed: not a pointer', args)
                        }
                    }
                }
                return result
            }
        )

        let comma = new BuiltinCustomOp(
            ',',
            2,
            (args: Value[]) => {
                if (args.length !== 2) {
                    return TypeError.createError('expecting 2 values being')
                }
                let leftValue = args[0]
                let rightValue = args[1]
                let leftType = leftValue.getType()
                let rightType = rightValue.getType()
                if (!TypeUtils.isTensorType(leftType) || !TypeUtils.isTensorType(rightType)) {
                    return TypeError.createError('Only scalar/vector/matrix types can be grouped together')
                }
                let leftCat = leftType.getCategory()
                let rightCat = rightType.getCategory()
                if (leftCat === TypeCategory.Scalar && rightCat === TypeCategory.Scalar) {
                    return TypeError.createNoError()
                }
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Scalar) {
                    return TypeError.createNoError()
                }
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Vector) {
                    let vec0 = leftType as VectorType
                    let vec1 = rightType as VectorType
                    if (vec0.getNumRows() !== vec1.getNumRows()) {
                        return TypeError.createError('vectors with different number of rows cannot be grouped together')
                    }
                    return TypeError.createNoError()
                }
                if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Vector) {
                    let mat0 = leftType as MatrixType
                    let vec1 = rightType as VectorType
                    if (mat0.getNumCols() !== vec1.getNumRows()) {
                        return TypeError.createError(
                            "cannot append to a matrix a vector whose number of rows don't match"
                        )
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError('invalid grouping')
            },
            (args: Value[]) => {
                let leftValue = args[0]
                let rightValue = args[1]
                let leftType = leftValue.getType()
                let rightType = rightValue.getType()
                let leftPrim = TypeUtils.getPrimitiveType(leftType)
                let rightPrim = TypeUtils.getPrimitiveType(rightType)
                let hasFloat = leftPrim === PrimitiveType.f32 || rightPrim === PrimitiveType.f32
                if (hasFloat) {
                    leftValue = opsMap.get('f32')!.apply([leftValue])
                    rightValue = opsMap.get('f32')!.apply([rightValue])
                }
                let leftCat = leftType.getCategory()
                let rightCat = rightType.getCategory()
                if (leftCat === TypeCategory.Scalar && rightCat === TypeCategory.Scalar) {
                    return ValueUtils.makeVectorFromScalars([leftValue, rightValue])
                }
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Scalar) {
                    return ValueUtils.addScalarToVector(leftValue, rightValue)
                }
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Vector) {
                    return ValueUtils.makeMatrixFromVectorsAsRows([leftValue, rightValue])
                }
                if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Vector) {
                    return ValueUtils.addRowVectorToMatrix(leftValue, rightValue)
                }
                // shouldn't happen
                return leftValue
            }
        )

        let concat = new BuiltinCustomOp(
            'concat',
            2,
            (args: Value[]) => {
                if (args.length !== 2) {
                    return TypeError.createError('can only concat among two values')
                }
                let leftValue = args[0]
                let rightValue = args[1]
                let leftType = leftValue.getType()
                let rightType = rightValue.getType()
                let leftCat = leftType.getCategory()
                let rightCat = rightType.getCategory()
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Matrix) {
                    let mat0 = leftType as MatrixType
                    let mat1 = rightType as MatrixType
                    if (mat0.getNumCols() !== mat1.getNumCols()) {
                        return TypeError.createError('cannot concat matrices with different amount of columns')
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError('cannot only concat two vectors or two matrices')
            },
            (args: Value[]) => {
                let leftValue = args[0]
                let rightValue = args[1]
                let leftType = leftValue.getType()
                let rightType = rightValue.getType()
                let leftCat = leftType.getCategory()
                let rightCat = rightType.getCategory()
                let leftPrim = TypeUtils.getPrimitiveType(leftType)
                let rightPrim = TypeUtils.getPrimitiveType(rightType)
                let hasFloat = leftPrim === PrimitiveType.f32 || rightPrim === PrimitiveType.f32
                if (hasFloat) {
                    leftValue = opsMap.get('f32')!.apply([leftValue])
                    rightValue = opsMap.get('f32')!.apply([rightValue])
                }
                if (leftCat === TypeCategory.Vector && rightCat === TypeCategory.Vector) {
                    return ValueUtils.concatVectors(leftValue, rightValue)
                }
                if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Matrix) {
                    return ValueUtils.concatMatrices(leftValue, rightValue)
                }
                // shouldn't happen
                return leftValue
            }
        )

        let len = new BuiltinCustomOp(
            'len',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vector')
                }
            },
            (args: Value[]) => {
                let numRows = (args[0].getType() as VectorType).getNumRows()
                return ValueUtils.makeConstantScalar(numRows, irBuilder.get_int32(numRows), PrimitiveType.i32)
            }
        )
        let length = new BuiltinCustomOp(
            'length',
            1,
            (args: Value[]) => len.checkType(args),
            (args: Value[]) => len.apply(args)
        )

        let sum = new BuiltinCustomOp(
            'sum',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vector')
                }
            },
            (args: Value[]) => {
                let sum = ValueUtils.makeConstantScalar(0.0, irBuilder.get_float32(0.0), PrimitiveType.f32)
                let components = ValueUtils.getVectorComponents(args[0])
                for (let comp of components) {
                    sum = opsMap.get('+')!.apply([sum, comp])
                }
                return sum
            }
        )

        let norm_sqr = new BuiltinCustomOp(
            'norm_sqr',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vector')
                }
            },
            (args: Value[]) => {
                let squared = opsMap.get('*')!.apply([args[0], args[0]])
                let result = sum.apply([squared])
                return result
            }
        )

        let norm = new BuiltinCustomOp(
            'norm',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vector')
                }
            },
            (args: Value[]) => {
                let resultSqr = norm_sqr.apply(args)
                let result = opsMap.get('sqrt')!.apply([resultSqr])
                return result
            }
        )

        let normalized = new BuiltinCustomOp(
            'normalized',
            1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vector')
                }
            },
            (args: Value[]) => {
                let normValue = norm.apply(args)
                let result = opsMap.get('/')!.apply([args[0], normValue])
                return result
            }
        )

        let dot = new BuiltinCustomOp(
            'dot',
            2,
            (args: Value[]) => {
                let valid =
                    args.length === 2 &&
                    args[0].getType().getCategory() === TypeCategory.Vector &&
                    args[1].getType().getCategory() === TypeCategory.Vector &&
                    (args[0].getType() as VectorType).getNumRows() === (args[1].getType() as VectorType).getNumRows()
                if (valid) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vectors of the same size ')
                }
            },
            (args: Value[]) => {
                let product = opsMap.get('*')!.apply([args[0], args[1]])
                return sum.apply([product])
            }
        )

        let cross = new BuiltinCustomOp(
            'cross',
            2,
            (args: Value[]) => {
                let valid =
                    args.length === 2 &&
                    args[0].getType().getCategory() === TypeCategory.Vector &&
                    args[1].getType().getCategory() === TypeCategory.Vector &&
                    (args[0].getType() as VectorType).getNumRows() === 3 &&
                    (args[1].getType() as VectorType).getNumRows() === 3
                if (valid) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting 3D vectors')
                }
            },
            (args: Value[]) => {
                let left: Value[] = ValueUtils.getVectorComponents(args[0])
                let right: Value[] = ValueUtils.getVectorComponents(args[1])

                let r0 = opsMap
                    .get('-')!
                    .apply([opsMap.get('*')!.apply([left[1], right[2]]), opsMap.get('*')!.apply([left[2], right[1]])])
                let r1 = opsMap
                    .get('-')!
                    .apply([opsMap.get('*')!.apply([left[2], right[0]]), opsMap.get('*')!.apply([left[0], right[2]])])
                let r2 = opsMap
                    .get('-')!
                    .apply([opsMap.get('*')!.apply([left[0], right[1]]), opsMap.get('*')!.apply([left[1], right[0]])])
                return ValueUtils.makeVectorFromScalars([r0, r1, r2])
            }
        )

        let outer_product = new BuiltinCustomOp(
            'outer_product',
            2,
            (args: Value[]) => {
                let valid =
                    args.length === 2 &&
                    args[0].getType().getCategory() === TypeCategory.Vector &&
                    args[1].getType().getCategory() === TypeCategory.Vector
                if (valid) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting vectors')
                }
            },
            (args: Value[]) => {
                let left: Value[] = ValueUtils.getVectorComponents(args[0])
                let right: Value[] = ValueUtils.getVectorComponents(args[1])
                let resultRows = left.length
                let resultCols = right.length
                let resultValues: Value[][] = []

                for (let row = 0; row < resultRows; ++row) {
                    let thisRow: Value[] = []
                    for (let col = 0; col < resultCols; ++col) {
                        let thisElement = opsMap.get('*')!.apply([left[row], right[col]])
                        thisRow.push(thisElement)
                    }
                    resultValues.push(thisRow)
                }

                return ValueUtils.makeMatrixFromScalars(resultValues)
            }
        )

        let matmul = new BuiltinCustomOp(
            'matmul',
            2,
            (args: Value[]) => {
                let type0 = args[0].getType()
                let type1 = args[1].getType()
                if (type0.getCategory() !== TypeCategory.Matrix) {
                    return TypeError.createError('LHS of the matrix multiplication must be a matrix')
                }
                let mat0 = type0 as MatrixType
                if (type1.getCategory() === TypeCategory.Matrix) {
                    let mat1 = type1 as MatrixType
                    if (mat0.getNumCols() === mat1.getNumRows()) {
                        return TypeError.createNoError()
                    } else {
                        return TypeError.createError(
                            `size mismatch during matrix-matrix multiplication: LHS num cols = ${mat0.getNumCols()}, but RHS num rows = ${mat1.getNumRows()}`
                        )
                    }
                } else if (type1.getCategory() === TypeCategory.Vector) {
                    let vec1 = type1 as VectorType
                    if (mat0.getNumCols() === vec1.getNumRows()) {
                        return TypeError.createNoError()
                    } else {
                        return TypeError.createError(
                            `size mismatch during matrix-vector multiplication: LHS num cols = ${mat0.getNumCols()}, but RHS num rows = ${vec1.getNumRows()}`
                        )
                    }
                } else {
                    return TypeError.createError('RHS of the matrix multiplication must be a matrix or a vector')
                }
            },
            (args: Value[]) => {
                let type0 = args[0].getType()
                let type1 = args[1].getType()
                let mat0 = type0 as MatrixType
                let rows0: Value[] = ValueUtils.getMatrixRowVectors(args[0])

                if (type1.getCategory() === TypeCategory.Matrix) {
                    let mat1 = type1 as MatrixType
                    let resultRows = mat0.getNumRows()
                    let resultCols = mat1.getNumCols()
                    let resultValues: Value[][] = []
                    let cols1 = ValueUtils.getMatrixColVectors(args[1])
                    for (let r = 0; r < resultRows; ++r) {
                        let thisRow: Value[] = []
                        for (let c = 0; c < resultCols; ++c) {
                            thisRow.push(dot.apply([rows0[r], cols1[c]]))
                        }
                        resultValues.push(thisRow)
                    }
                    return ValueUtils.makeMatrixFromScalars(resultValues)
                } else if (type1.getCategory() === TypeCategory.Vector) {
                    let resultRows = mat0.getNumRows()
                    let resultValues: Value[] = []
                    for (let r = 0; r < resultRows; ++r) {
                        resultValues.push(dot.apply([rows0[r], args[1]]))
                    }
                    return ValueUtils.makeVectorFromScalars(resultValues)
                } else {
                    error('[Compiler bug]', 'unrecognized matmul')
                    return args[0]
                }
            }
        )

        let transpose = new BuiltinCustomOp(
            'transpose',
            1,
            (args: Value[]) => {
                let valid = args.length === 1 && args[0].getType().getCategory() === TypeCategory.Matrix
                if (valid) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('expecting matrix')
                }
            },
            (args: Value[]) => {
                return ValueUtils.transposeMatrix(args[0])
            }
        )
        let static_ = new BuiltinCustomOp(
            'static',
            1,
            (args: Value[]) => {
                if (args.length !== 1) {
                    return TypeError.createError('static(...) requires exactly 1 argument')
                }
                if (!args[0].isCompileTimeConstant()) {
                    return TypeError.createError('static(...) requires a compile-time constant argument')
                }
                return TypeError.createNoError()
            },
            (args: Value[]) => {
                if (args[0].getType().getCategory() === TypeCategory.HostObjectReference) {
                    return ValueUtils.makeHostObjectReference(args[0].hostSideValue, /*markedAsConstant = */ true)
                }
                return args[0]
            }
        )

        let Static = new BuiltinCustomOp(
            'Static',
            1,
            (args: Value[]) => {
                return static_.checkType(args)
            },
            (args: Value[]) => {
                return static_.apply(args)
            }
        )

        let mergeStructs = new BuiltinCustomOp(
            'mergeStructs',
            2,
            (args: Value[]) => {
                if (args.length !== 2) {
                    return TypeError.createError('ti.mergeStructs(...) requires 2 structs to be merged')
                }
                if (
                    args[0].getType().getCategory() !== TypeCategory.Struct ||
                    args[1].getType().getCategory() !== TypeCategory.Struct
                ) {
                    return TypeError.createError('arguments to ti.mergeStructs(...) must be structs')
                }
                let struct0 = args[0].getType() as StructType
                let struct1 = args[1].getType() as StructType
                for (let name0 of struct0.getPropertyNames()) {
                    for (let name1 of struct1.getPropertyNames()) {
                        if (name0 === name1) {
                            return TypeError.createError('structs to be named cannot have overlapping property names')
                        }
                    }
                }
                return TypeError.createNoError()
            },
            (args: Value[]) => {
                let struct0 = args[0].getType() as StructType
                let struct1 = args[1].getType() as StructType
                let names0 = struct0.getPropertyNames()
                let names1 = struct1.getPropertyNames()
                let names = names0.concat(names1)
                let members0 = ValueUtils.getStructMembers(args[0])
                let members1 = ValueUtils.getStructMembers(args[1])
                let members = new Map<string, Value>()
                for (let name of names0) {
                    members.set(name, members0.get(name)!)
                }
                for (let name of names1) {
                    members.set(name, members1.get(name)!)
                }
                return ValueUtils.makeStruct(names, members)
            }
        )

        let slice = new BuiltinCustomOp(
            'slice',
            3,
            (args: Value[]) => {
                if (args.length < 2 || args.length > 3) {
                    return TypeError.createError('unsupported overload of slice()')
                }
                let val = args[0]
                let valType = val.getType()
                for (let i = 1; i < args.length; ++i) {
                    if (!args[i].isCompileTimeConstant()) {
                        return TypeError.createError('slice() begin and end must be compile-time constants')
                    }
                }
                if (valType.getCategory() === TypeCategory.Vector) {
                    if (args[1].getType().getCategory() !== TypeCategory.Scalar) {
                        return TypeError.createError('vectors can only be sliced with scalar indices')
                    }
                    if (args.length === 3 && args[2].getType().getCategory() !== TypeCategory.Scalar) {
                        return TypeError.createError('vectors can only be sliced with scalar indices')
                    }
                    return TypeError.createNoError()
                } else if (valType.getCategory() === TypeCategory.Matrix) {
                    if (
                        args[1].getType().getCategory() !== TypeCategory.Scalar &&
                        args[1].getType().getCategory() !== TypeCategory.Vector
                    ) {
                        return TypeError.createError('matrices can only be sliced with scalar or vector indices')
                    }
                    if (args.length === 3) {
                        if (args[1].getType().getCategory() !== args[2].getType().getCategory()) {
                            return TypeError.createError(
                                'when slicing a matrix, begin and end must both be scalars or both be vectors'
                            )
                        }
                    }
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError('matrices can only be sliced with scalar or vector indices')
                }
            },
            (args: Value[]) => {
                let val = args[0]
                let valType = val.getType()
                if (valType.getCategory() === TypeCategory.Vector) {
                    let begin = args[1].compileTimeConstants[0]
                    let end = val.stmts.length
                    if (args.length === 3) {
                        end = args[2].compileTimeConstants[0]
                    }
                    let numRows = end - begin
                    let components = ValueUtils.getVectorComponents(val)
                    components = components.slice(begin, end)
                    return ValueUtils.makeVectorFromScalars(components)
                } else {
                    // if (valType.getCategory() === TypeCategory.Matrix) {
                    let matType = valType as MatrixType
                    let begin = args[1].compileTimeConstants
                    let end = [matType.getNumRows(), matType.getNumCols()]
                    if (args.length === 3) {
                        end = args[2].compileTimeConstants
                    }
                    if (begin.length === 1) {
                        begin.push(matType.getNumCols())
                    }
                    if (end.length === 1) {
                        end.push(matType.getNumCols())
                    }
                    let numRows = end[0] - begin[0]
                    let numCols = end[1] - begin[1]

                    let components = ValueUtils.getMatrixComponents(val)
                    components = components.slice(begin[0], end[0])
                    for (let i = 0; i < numRows; ++i) {
                        components[i] = components[i].slice(begin[1], end[1])
                    }
                    return ValueUtils.makeMatrixFromScalars(components)
                }
            }
        )

        let ops2 = [
            store,
            load,
            comma,
            concat,
            len,
            length,
            sum,
            norm_sqr,
            norm,
            normalized,
            dot,
            cross,
            matmul,
            transpose,
            outer_product,
            static_,
            Static,
            mergeStructs,
            slice,
        ]
        for (let op of ops2) {
            opsMap.set(op.name, op)
        }

        return opsMap
    }
}

export {
    BuiltinOp,
    BuiltinNullaryOp,
    BuiltinBinaryOp,
    BuiltinUnaryOp,
    BuiltinAtomicOp,
    BuiltinCustomOp,
    BuiltinOpFactory,
}
