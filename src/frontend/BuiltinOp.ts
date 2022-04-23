import { Type, TypeCategory, ScalarType, VectorType, MatrixType, PointerType, VoidType, TypeUtils, PrimitiveType, toNativePrimitiveType, TypeError } from "./Type"
import { nativeTaichi, NativeTaichiAny } from "../native/taichi/GetTaichi"
import { ResultOrError } from "./Error"
import { assert, error } from "../utils/Logging"
import { Value, ValueUtils } from "./Value"

class BuiltinOp {
    constructor(
        public name: string,
        public arity: number
    ) {

    }

    checkType(args: Value[]): TypeError {
        return TypeError.createError("calling checkType from BuiltinOp base")
    }

    apply(args: Value[]): Value {
        error("calling apply from BuiltinOp base")
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
        return TypeError.createError("wrong number of arguments, expecting 0, got " + args.length.toString())
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, "[Compiler Bug]", "nullary op type check failed", typeError.msg);
        return this.func()
    }
}

class BuiltinUnaryOp extends BuiltinOp {
    constructor(
        name: string,
        public forceReturnType: PrimitiveType | null,
        public f: (stmt: NativeTaichiAny) => NativeTaichiAny,
        public fConst: ((val: number) => number) | null = null
    ) {
        super(name, 1)
    }

    override checkType(args: Value[]): TypeError {
        if (args.length !== 1) {
            return TypeError.createError("wrong number of arguments")
        }

        if (!TypeUtils.isTensorType(args[0].getType())) {
            return TypeError.createError("can only be applied to scalar/vector/matrix types")
        }
        return TypeError.createNoError()
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, "[Compiler Bug]", "unary op type check failed", typeError.msg)
        let arg = args[0]

        let returnType = arg.getType()
        if (this.forceReturnType !== null) {
            returnType = TypeUtils.replacePrimitiveType(returnType, this.forceReturnType)
        }
        let result = new Value(returnType, [], [])
        for (let i = 0; i < arg.stmts.length; ++i) {
            result.stmts.push(this.f(arg.stmts[i]))
            if (this.fConst && arg.isCompileTimeConstant()) {
                result.compileTimeConstants.push(this.fConst(arg.compileTimeConstants[i]))
            }
        }
        return result
    }
}

enum BinaryOpDatatypeTransform {
    AlwaysF32,
    AlwaysI32,
    AlwaysVoid,
    PromoteToMatch,
    ForceLeft,
}

class BuiltinBinaryOp extends BuiltinOp {
    constructor(
        name: string,
        public dataTypeTransform: BinaryOpDatatypeTransform,
        public allowBroadcastLeftToRight: boolean,
        public allowBroadcastRightToLeft: boolean,
        public f: (left: NativeTaichiAny, right: NativeTaichiAny) => (NativeTaichiAny | null),
        public fConst: ((left: number, right: number) => number) | null = null
    ) {
        super(name, 2)
    }

    override checkType(args: Value[]): TypeError {
        if (args.length !== 2) {
            return TypeError.createError("wrong number of arguments")
        }
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()

        if (!TypeUtils.isTensorType(type0)) {
            TypeError.createError("can only be applied to scalar/vector/matrix types")
        }
        if (!TypeUtils.isTensorType(type1)) {
            TypeError.createError("can only be applied to scalar/vector/matrix types")
        }
        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar) {
                if (this.allowBroadcastLeftToRight) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("Broadcast (left to right) not allowed")
                }
            }
            else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar) {
                if (this.allowBroadcastRightToLeft) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("Broadcast (right to left) not allowed")
                }
            }
            return TypeError.createError("Incompatible types")
        }
        else { // cat0 === cat1
            if (cat0 === TypeCategory.Scalar) {
                return TypeError.createNoError()
            }
            else if (cat0 === TypeCategory.Vector) {
                if ((type0 as VectorType).getNumRows() === (type1 as VectorType).getNumRows()) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("numRows mismatch")
                }
            }
            else if (cat0 === TypeCategory.Matrix) {
                let mat0 = (type0) as MatrixType
                let mat1 = (type1) as MatrixType
                if (mat0.getNumRows() === mat0.getNumRows() && mat1.getNumCols() === mat1.getNumCols()) {
                    return TypeError.createNoError()
                } else {
                    return TypeError.createError("matrix shape mismatch")
                }
            }
            error("[Compiler Bug]", "cat0 is not tensor type");
            return TypeError.createError("[Compiler Bug] cat0 is not tensor type")
        }
    }

    private getResultPrimitiveType(prim0: PrimitiveType, prim1: PrimitiveType): PrimitiveType {
        assert(this.dataTypeTransform !== BinaryOpDatatypeTransform.AlwaysVoid)
        switch (this.dataTypeTransform) {
            case BinaryOpDatatypeTransform.AlwaysF32: return PrimitiveType.f32
            case BinaryOpDatatypeTransform.AlwaysI32: return PrimitiveType.i32
            case BinaryOpDatatypeTransform.ForceLeft: return prim0
            case BinaryOpDatatypeTransform.PromoteToMatch: {
                if (prim0 === PrimitiveType.f32 || prim1 === PrimitiveType.f32) {
                    return PrimitiveType.f32
                }
                return PrimitiveType.i32
            }
            default:
                error("[Compiler Bug]", "result is void type")
                return PrimitiveType.f32
        }
    }

    private getResultType(type0: Type, type1: Type) {
        // assuming checkType

        if (this.dataTypeTransform === BinaryOpDatatypeTransform.AlwaysVoid) {
            return new VoidType()
        }
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()
        let prim0 = TypeUtils.getPrimitiveType(type0)
        let prim1 = TypeUtils.getPrimitiveType(type1)
        let resultPrim = this.getResultPrimitiveType(prim0, prim1)

        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar && this.allowBroadcastLeftToRight) {
                return TypeUtils.replacePrimitiveType(type1, resultPrim)
            }
            else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar && this.allowBroadcastRightToLeft) {
                return TypeUtils.replacePrimitiveType(type0, resultPrim)
            }
            error("[Compiler Bug]", "bad broadcase")
            return type0
        }
        else { // cat0 === cat1
            return TypeUtils.replacePrimitiveType(type0, resultPrim)
        }
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, "[Compiler Bug]", "binary op type check failed", typeError.msg)
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        let cat1 = type1.getCategory()

        let resultType = this.getResultType(type0, type1)
        let result = new Value(resultType, [], [])

        let shouldEvaluateConstexpr = args[0].isCompileTimeConstant() && args[1].isCompileTimeConstant() && this.fConst !== null

        if (cat0 !== cat1) {
            if (cat0 === TypeCategory.Scalar && cat1 !== TypeCategory.Scalar && this.allowBroadcastLeftToRight) {
                for (let i = 0; i < args[1].stmts.length; ++i) {
                    result.stmts.push(this.f(args[0].stmts[0], args[1].stmts[i]))
                    if (shouldEvaluateConstexpr) {
                        result.compileTimeConstants.push(this.fConst!(args[0].compileTimeConstants[0], args[1].compileTimeConstants[i]))
                    }
                }
            }
            else if (cat0 !== TypeCategory.Scalar && cat1 === TypeCategory.Scalar && this.allowBroadcastRightToLeft) {
                for (let i = 0; i < args[0].stmts.length; ++i) {
                    result.stmts.push(this.f(args[0].stmts[i], args[1].stmts[0]))
                    if (shouldEvaluateConstexpr) {
                        result.compileTimeConstants.push(this.fConst!(args[0].compileTimeConstants[i], args[1].compileTimeConstants[0]))
                    }
                }
            }
        }
        else { // cat0 === cat1
            for (let i = 0; i < args[0].stmts.length; ++i) {
                result.stmts.push(this.f(args[0].stmts[i], args[1].stmts[i]))
                if (shouldEvaluateConstexpr) {
                    result.compileTimeConstants.push(this.fConst!(args[0].compileTimeConstants[i], args[1].compileTimeConstants[i]))
                }
            }
        }
        if (this.dataTypeTransform === BinaryOpDatatypeTransform.AlwaysVoid) {
            result.stmts = []
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

    apply_: (args: Value[]) => Value
    checkType_: (args: Value[]) => TypeError

    override checkType(args: Value[]): TypeError {
        return this.checkType_(args)
    }

    apply(args: Value[]): Value {
        let typeError = this.checkType(args)
        assert(!typeError.hasError, "[Compiler Bug]", "custom op type check failed", typeError.msg)
        return this.apply_(args)
    }
}

class BuiltinAtomicOp extends BuiltinOp {
    constructor(
        name: string,
        public irBuilder: NativeTaichiAny, // needed for the f32 caster
        public irBuilderFunc: (dest: NativeTaichiAny, val: NativeTaichiAny) => NativeTaichiAny
    ) {
        super(name, 2)
        this.f32Caster = new BuiltinUnaryOp("f32", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.f32)))
    }

    private f32Caster: BuiltinUnaryOp

    override checkType(args: Value[]): TypeError {
        if (args.length !== 2) {
            return TypeError.createError("atomic op must be of the form ti.atomic_XX(dest,val) or dest op= val")
        }
        let type0 = args[0].getType()
        let type1 = args[1].getType()
        let cat0 = type0.getCategory()
        if (cat0 !== TypeCategory.Pointer) {
            return TypeError.createError("destination of atomic operation must be an lvalue")
        }
        let pointerType = type0 as PointerType
        if (!TypeUtils.isTensorType(pointerType.getValueType())) {
            return TypeError.createError("destination of atomic operation must be a scalar, vector, or a matrix")
        }
        if (!TypeUtils.isTensorType(type1)) {
            return TypeError.createError("operand of atomic operation must be a scalar, vector, or a matrix")
        }
        let prim0 = TypeUtils.getPrimitiveType(pointerType.getValueType())
        let prim1 = TypeUtils.getPrimitiveType(type1)
        if (prim0 === PrimitiveType.i32 && prim1 === PrimitiveType.f32) {
            return TypeError.createError("Atomic op type error: destination is i32 but operand is f32")
        }
        if (!pointerType.getValueType().equals(TypeUtils.replacePrimitiveType(type1, prim0))) {
            return TypeError.createError("Mismatch between operand and destination shape (broadcasting not allowed)")
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
            // for some reason, CHI IR throws a warning in this case (even though it doesn't for a regular assignment float=int)
            // so we cast explicitly
            args[1] = this.f32Caster.apply([args[1]])
        }
        let result = new Value(destValueType, [], [])
        for (let i = 0; i < args[0].stmts.length; ++i) {
            result.stmts.push(this.irBuilderFunc(args[0].stmts[i], args[1].stmts[i]))
        }
        return result
    }
}

class BuiltinOpFactory {

    static getAtomicOps(irBuilder: NativeTaichiAny): Map<string, BuiltinAtomicOp> {
        let opsMap = new Map<string, BuiltinAtomicOp>()
        let ops: BuiltinAtomicOp[] = [
            new BuiltinAtomicOp("atomic_add", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_add(dest, val)),
            new BuiltinAtomicOp("atomic_sub", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_sub(dest, val)),
            new BuiltinAtomicOp("atomic_max", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_max(dest, val)),
            new BuiltinAtomicOp("atomic_min", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_min(dest, val)),
            new BuiltinAtomicOp("atomic_and", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_and(dest, val)),
            new BuiltinAtomicOp("atomic_or", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_or(dest, val)),
            new BuiltinAtomicOp("atomic_xor", irBuilder, (dest: NativeTaichiAny, val: NativeTaichiAny) => irBuilder.create_atomic_xor(dest, val)),
        ]
        for (let op of ops) {
            opsMap.set(op.name, op)
        }
        return opsMap
    }

    static getBuiltinOps(irBuilder: NativeTaichiAny): Map<string, BuiltinOp> {
        let opsMap = new Map<string, BuiltinOp>()
        let ops: BuiltinOp[] = [
            new BuiltinBinaryOp("+", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_add(l, r), (l, r) => l + r),
            new BuiltinBinaryOp("-", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_sub(l, r), (l, r) => l - r),
            new BuiltinBinaryOp("*", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_mul(l, r), (l, r) => l - r),
            new BuiltinBinaryOp("**", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_pow(l, r), (l, r) => Math.pow(l, r)),
            new BuiltinBinaryOp("%", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_mod(l, r), (l, r) => l % r),
            new BuiltinBinaryOp("<", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_lt(l, r), (l, r) => Number(l < r)),
            new BuiltinBinaryOp("<=", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_le(l, r), (l, r) => Number(l <= r)),
            new BuiltinBinaryOp(">", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_gt(l, r), (l, r) => Number(l > r)),
            new BuiltinBinaryOp(">=", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_ge(l, r), (l, r) => Number(l >= r)),
            new BuiltinBinaryOp("==", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_eq(l, r), (l, r) => Number(l === r)),
            new BuiltinBinaryOp("!=", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_ne(l, r), (l, r) => Number(l !== r)),
            new BuiltinBinaryOp("===", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_eq(l, r), (l, r) => Number(l === r)),
            new BuiltinBinaryOp("!==", BinaryOpDatatypeTransform.AlwaysI32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_cmp_ne(l, r), (l, r) => Number(l !== r)),
            new BuiltinBinaryOp("&", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_and(l, r), (l, r) => l & r),
            new BuiltinBinaryOp("&&", BinaryOpDatatypeTransform.PromoteToMatch, false, false, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_and(l, r), (l, r) => l & r),
            new BuiltinBinaryOp("|", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_or(l, r), (l, r) => l & r),
            new BuiltinBinaryOp("||", BinaryOpDatatypeTransform.PromoteToMatch, false, false, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_or(l, r), (l, r) => l & r),
            new BuiltinBinaryOp("^", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_xor(l, r), (l, r) => l & r),

            new BuiltinBinaryOp("/", BinaryOpDatatypeTransform.AlwaysF32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_truediv(l, r), (l, r) => l / r),

            new BuiltinUnaryOp("sin", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_sin(stmt)),
            new BuiltinUnaryOp("cos", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_cos(stmt)),
            new BuiltinUnaryOp("asin", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_asin(stmt)),
            new BuiltinUnaryOp("acos", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_acos(stmt)),
            new BuiltinUnaryOp("tan", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_tan(stmt)),
            new BuiltinUnaryOp("tanh", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_tanh(stmt)),
            new BuiltinUnaryOp("exp", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_exp(stmt)),
            new BuiltinUnaryOp("log", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_log(stmt)),
            new BuiltinUnaryOp("neg", null, (stmt: NativeTaichiAny) => irBuilder.create_neg(stmt), (x) => -x),
            new BuiltinUnaryOp("not", PrimitiveType.i32, (stmt: NativeTaichiAny) => irBuilder.create_not(stmt)),
            new BuiltinUnaryOp("logical_not", PrimitiveType.i32, (stmt: NativeTaichiAny) => irBuilder.create_logical_not(stmt)),
            new BuiltinUnaryOp("abs", null, (stmt: NativeTaichiAny) => irBuilder.create_abs(stmt)),
            new BuiltinUnaryOp("floor", null, (stmt: NativeTaichiAny) => irBuilder.create_floor(stmt)),
            new BuiltinUnaryOp("sgn", PrimitiveType.i32, (stmt: NativeTaichiAny) => irBuilder.create_sgn(stmt)),
            new BuiltinUnaryOp("sqrt", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_sqrt(stmt)),
            new BuiltinUnaryOp("rsqrt", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_rsqrt(stmt)),

            new BuiltinUnaryOp("i32", PrimitiveType.i32, (stmt: NativeTaichiAny) => irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.i32)), (x) => Math.floor(x)),
            new BuiltinUnaryOp("f32", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_cast(stmt, toNativePrimitiveType(PrimitiveType.f32)), (x) => x),
            new BuiltinUnaryOp("bitcast_f32", PrimitiveType.f32, (stmt: NativeTaichiAny) => irBuilder.create_bit_cast(stmt, toNativePrimitiveType(PrimitiveType.f32)), (x) => x),
            new BuiltinUnaryOp("bitcast_i32", PrimitiveType.i32, (stmt: NativeTaichiAny) => irBuilder.create_bit_cast(stmt, toNativePrimitiveType(PrimitiveType.i32)), (x) => x),

            new BuiltinBinaryOp("max", BinaryOpDatatypeTransform.PromoteToMatch, false, false, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_max(l, r), (l, r) => Math.max(l, r)),
            new BuiltinBinaryOp("min", BinaryOpDatatypeTransform.PromoteToMatch, false, false, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_min(l, r), (l, r) => Math.min(l, r)),
            new BuiltinBinaryOp("pow", BinaryOpDatatypeTransform.PromoteToMatch, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_pow(l, r), (l, r) => Math.pow(l, r)),
            new BuiltinBinaryOp("atan2", BinaryOpDatatypeTransform.AlwaysF32, true, true, (l: NativeTaichiAny, r: NativeTaichiAny) => irBuilder.create_atan2(l, r), (l, r) => Math.atan2(l, r)),

            new BuiltinNullaryOp("random", new ScalarType(PrimitiveType.f32), () => new Value(new ScalarType(PrimitiveType.f32), [irBuilder.create_rand(toNativePrimitiveType(PrimitiveType.f32))], [])),

        ]
        for (let op of ops) {
            opsMap.set(op.name, op)
        }

        let store = new BuiltinCustomOp("=", 2,
            (args: Value[]): TypeError => {
                if (args.length !== 2) {
                    return TypeError.createError("what??")
                }
                if (args[0].getType().getCategory() !== TypeCategory.Pointer) {
                    return TypeError.createError("expecting left hand side of assignment to be an lvalue")
                }
                let pointerType = args[0].getType() as PointerType
                let type1 = args[1].getType()
                if (TypeUtils.isTensorType(pointerType.getValueType()) && TypeUtils.isTensorType(type1)) {
                    let destPrim = TypeUtils.getPrimitiveType(pointerType.getValueType())
                    let valPrim = TypeUtils.getPrimitiveType(type1)
                    if (destPrim === PrimitiveType.i32 && valPrim === PrimitiveType.f32 && !pointerType.getIsGlobal()) {
                        // in Python taichi, this will cause native taichi to trigger a warning.
                        // instead, taichi.js directy throws an error.
                        // We only throw error for local i32 <- f32 because this is a much more common source of bugs.
                        return TypeError.createError("storing f32 into a i32 local variable.")
                    }
                    if (TypeUtils.tensorTypeShapeMatch(pointerType.getValueType(), type1)) {
                        return TypeError.createNoError()
                    }
                    if (type1.getCategory() === TypeCategory.Scalar) {
                        // broadcast right to left
                        return TypeError.createNoError()
                    }
                    return TypeError.createError("Shape mismatch in assignment")
                }
                else if (pointerType.getValueType().getCategory() === TypeCategory.Struct && type1.getCategory() === TypeCategory.Struct) {
                    if (!pointerType.getValueType().equals(type1)) {
                        TypeError.createError("struct type mismatch")
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError("invalid assignment")
            },
            (args: Value[]): Value => {
                let pointerType = args[0].getType() as PointerType
                let type1 = args[1].getType()
                let storeFunc = (ptr: NativeTaichiAny, value: NativeTaichiAny) => {
                    irBuilder.create_global_ptr_global_store(ptr, value)
                }
                if (!pointerType.getIsGlobal()) {
                    storeFunc = (ptr: NativeTaichiAny, value: NativeTaichiAny) => {
                        irBuilder.create_local_store(ptr, value)
                    }
                }

                if (TypeUtils.isTensorType(pointerType.getValueType()) && TypeUtils.isTensorType(args[1].getType())) {
                    let destPrim = TypeUtils.getPrimitiveType(pointerType.getValueType())
                    let valPrim = TypeUtils.getPrimitiveType(type1)
                    if (destPrim === PrimitiveType.f32 && valPrim === PrimitiveType.i32) {
                        args[1] = opsMap.get("f32")!.apply([args[1]])
                    }
                    if (TypeUtils.tensorTypeShapeMatch(pointerType.getValueType(), type1)) {
                        assert(args[0].stmts.length === args[1].stmts.length, "[Compiler bug]", "Expecting stmts.length to match")
                        for (let i = 0; i < args[0].stmts.length; ++i) {
                            storeFunc(args[0].stmts[i], args[1].stmts[i])
                        }
                    }
                    else if (type1.getCategory() === TypeCategory.Scalar) {
                        // broadcast right to left
                        for (let i = 0; i < args[0].stmts.length; ++i) {
                            storeFunc(args[0].stmts[i], args[1].stmts[0])
                        }
                    }
                    else {
                        error("[Compiler bug]", "Shape mismatch in assignment")
                    }
                }
                else if (pointerType.getValueType().getCategory() === TypeCategory.Struct && type1.getCategory() === TypeCategory.Struct) {
                    for (let i = 0; i < args[0].stmts.length; ++i) {
                        storeFunc(args[0].stmts[i], args[1].stmts[i])
                    }
                }
                else {
                    error("[Compiler bug]", "invalid assignemnt")
                }
                return new Value(new VoidType, [], [])
            }
        )

        let load = new BuiltinCustomOp("load", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Pointer) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting pointer type")
                }
            },
            (args: Value[]) => {
                let pointerType = args[0].getType() as PointerType
                let resultType = pointerType.getValueType()
                let result = new Value(resultType, [])
                for (let i = 0; i < args[0].stmts.length; ++i) {
                    if (pointerType.getIsGlobal()) {
                        result.stmts.push(irBuilder.create_global_ptr_global_load(args[0].stmts[i]))
                    }
                    else {
                        result.stmts.push(irBuilder.create_local_load(args[0].stmts[i]))
                    }
                }
                return result
            }
        )

        let comma = new BuiltinCustomOp(",", 2,
            (args: Value[]) => {
                if (args.length !== 2) {
                    return TypeError.createError("expecting 2 values being")
                }
                let leftValue = args[0]
                let rightValue = args[1]
                let leftType = leftValue.getType()
                let rightType = rightValue.getType()
                if (!TypeUtils.isTensorType(leftType) || !TypeUtils.isTensorType(rightType)) {
                    return TypeError.createError("Only scalar/vector/matrix types can be grouped together")
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
                        return TypeError.createError("vectors with different number of rows cannot be grouped together")
                    }
                    return TypeError.createNoError()
                }
                if (leftCat === TypeCategory.Matrix && rightCat === TypeCategory.Vector) {
                    let mat0 = leftType as MatrixType
                    let vec1 = rightType as VectorType
                    if (mat0.getNumCols() !== vec1.getNumRows()) {
                        return TypeError.createError("cannot append to a matrix a vector whose number of rows don't match")
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError("invalid grouping")
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
                    leftValue = opsMap.get("f32")!.apply([leftValue])
                    rightValue = opsMap.get("f32")!.apply([rightValue])
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

        let concat = new BuiltinCustomOp("concat", 2,
            (args: Value[]) => {
                if (args.length !== 2) {
                    return TypeError.createError("can only concat among two values")
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
                        return TypeError.createError("cannot concat matrices with different amount of columns")
                    }
                    return TypeError.createNoError()
                }
                return TypeError.createError("cannot only concat two vectors or two matrices")
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
                    leftValue = opsMap.get("f32")!.apply([leftValue])
                    rightValue = opsMap.get("f32")!.apply([rightValue])
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

        let len = new BuiltinCustomOp("len", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vector")
                }
            },
            (args: Value[]) => {
                let numRows = (args[0].getType() as VectorType).getNumRows()
                return ValueUtils.makeConstantScalar(numRows, irBuilder.get_int32(numRows), PrimitiveType.i32)
            }
        )
        let length = new BuiltinCustomOp("length", 1, (args: Value[]) => len.checkType(args), (args: Value[]) => len.apply(args))

        let sum = new BuiltinCustomOp("sum", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vector")
                }
            },
            (args: Value[]) => {
                let sum = ValueUtils.makeConstantScalar(0.0, irBuilder.get_float32(0.0), PrimitiveType.f32)
                let components = ValueUtils.getVectorComponents(args[0])
                for (let comp of components) {
                    sum = opsMap.get("+")!.apply([sum, comp])
                }
                return sum
            }
        )

        let norm_sqr = new BuiltinCustomOp("norm_sqr", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vector")
                }
            },
            (args: Value[]) => {
                let squared = opsMap.get("*")!.apply([args[0], args[0]])
                let result = sum.apply([squared])
                return result
            }
        )

        let norm = new BuiltinCustomOp("norm", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vector")
                }
            },
            (args: Value[]) => {
                let resultSqr = norm_sqr.apply(args)
                let result = opsMap.get("sqrt")!.apply([resultSqr])
                return result
            }
        )

        let normalized = new BuiltinCustomOp("normalized", 1,
            (args: Value[]) => {
                if (args.length === 1 && args[0].getType().getCategory() === TypeCategory.Vector) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vector")
                }
            },
            (args: Value[]) => {
                let normValue = norm.apply(args)
                let result = opsMap.get("/")!.apply([args[0], normValue])
                return result
            }
        )

        let dot = new BuiltinCustomOp("dot", 2,
            (args: Value[]) => {
                let valid = args.length === 2
                    && args[0].getType().getCategory() === TypeCategory.Vector
                    && args[1].getType().getCategory() === TypeCategory.Vector
                    && (args[0].getType() as VectorType).getNumRows() === (args[1].getType() as VectorType).getNumRows()
                if (valid) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vectors of the same size ")
                }
            },
            (args: Value[]) => {
                let product = opsMap.get("*")!.apply([args[0], args[1]])
                return sum.apply([product])
            }
        )

        let cross = new BuiltinCustomOp("cross", 2,
            (args: Value[]) => {
                let valid = args.length === 2
                    && args[0].getType().getCategory() === TypeCategory.Vector
                    && args[1].getType().getCategory() === TypeCategory.Vector
                    && (args[0].getType() as VectorType).getNumRows() === 3
                    && (args[1].getType() as VectorType).getNumRows() === 3
                if (valid) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting 3D vectors")
                }
            },
            (args: Value[]) => {
                let left: Value[] = ValueUtils.getVectorComponents(args[0])
                let right: Value[] = ValueUtils.getVectorComponents(args[1])

                let r0 = opsMap.get("-")!.apply([
                    opsMap.get("*")!.apply([left[1], right[2]]),
                    opsMap.get("*")!.apply([left[2], right[1]]),
                ])
                let r1 = opsMap.get("-")!.apply([
                    opsMap.get("*")!.apply([left[2], right[0]]),
                    opsMap.get("*")!.apply([left[0], right[2]]),
                ])
                let r2 = opsMap.get("-")!.apply([
                    opsMap.get("*")!.apply([left[0], right[1]]),
                    opsMap.get("*")!.apply([left[1], right[0]]),
                ])
                return ValueUtils.makeVectorFromScalars([r0, r1, r2])
            }
        )

        let outer_product = new BuiltinCustomOp("outer_product", 2,
            (args: Value[]) => {
                let valid = args.length === 2
                    && args[0].getType().getCategory() === TypeCategory.Vector
                    && args[1].getType().getCategory() === TypeCategory.Vector
                if (valid) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting vectors")
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
                        let thisElement = opsMap.get("*")!.apply([left[row], right[col]])
                        thisRow.push(thisElement)
                    }
                    resultValues.push(thisRow)
                }

                return ValueUtils.makeMatrixFromScalars(resultValues)
            }
        )

        let matmul = new BuiltinCustomOp("matmul", 2,
            (args: Value[]) => {
                let type0 = args[0].getType()
                let type1 = args[1].getType()
                if (type0.getCategory() !== TypeCategory.Matrix) {
                    return TypeError.createError("LHS of the matrix multiplication must be a matrix")
                }
                let mat0 = type0 as MatrixType
                if (type1.getCategory() === TypeCategory.Matrix) {
                    let mat1 = type1 as MatrixType
                    if (mat0.getNumCols() === mat1.getNumRows()) {
                        return TypeError.createNoError()
                    }
                    else {
                        return TypeError.createError("Matrix size mismatch")
                    }
                } else if (type1.getCategory() === TypeCategory.Vector) {
                    let vec1 = type1 as VectorType
                    if (mat0.getNumCols() === vec1.getNumRows()) {
                        return TypeError.createNoError()
                    }
                    else {
                        return TypeError.createError("Matrix-Vector size mismatch")
                    }
                }
                else {
                    return TypeError.createError("RHS of the matrix multiplication must be a matrix or a vector")
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
                    error("[Compiler bug]", "unrecognized matmul");
                    return args[0]
                }
            }
        )

        let transpose = new BuiltinCustomOp("transpose", 1,
            (args: Value[]) => {
                let valid = args.length === 1
                    && args[0].getType().getCategory() === TypeCategory.Matrix
                if (valid) {
                    return TypeError.createNoError()
                }
                else {
                    return TypeError.createError("expecting matrix")
                }
            },
            (args: Value[]) => {
                return ValueUtils.transposeMatrix(args[0])
            }
        )
        let static_ = new BuiltinCustomOp("static", 1,
            (args: Value[]) => {
                if (args.length !== 1) {
                    return TypeError.createError("static(...) requires exactly 1 argument")
                }
                if (!args[0].isCompileTimeConstant()) {
                    return TypeError.createError("static(...) requires a compile-time constant argument")
                }
                return TypeError.createNoError()
            },
            (args: Value[]) => {
                return args[0]
            }
        )
        let ops2 = [store, load, comma, concat, len, length, sum, norm_sqr, norm, normalized, dot, cross, matmul, transpose, outer_product, static_]
        for (let op of ops2) {
            opsMap.set(op.name, op)
        }

        return opsMap

    }
}

export { BuiltinOp, BuiltinNullaryOp, BuiltinBinaryOp, BuiltinUnaryOp, BuiltinAtomicOp, BuiltinCustomOp, BuiltinOpFactory }