import { error } from '../../../utils/Logging'
import { StringBuilder } from '../../../utils/StringBuilder'
import { PrimitiveType } from '../../frontend/Type'
import {
    AllocaStmt,
    ArgLoadStmt,
    AtomicLoadStmt,
    AtomicOpStmt,
    AtomicOpType,
    AtomicStoreStmt,
    BinaryOpStmt,
    BinaryOpType,
    BuiltInInputKind,
    BuiltInInputStmt,
    BuiltInOutputKind,
    BuiltInOutputStmt,
    CompositeExtractStmt,
    ConstStmt,
    ContinueStmt,
    DiscardStmt,
    FragmentDerivativeDirection,
    FragmentDerivativeStmt,
    FragmentForStmt,
    FragmentInputStmt,
    GlobalLoadStmt,
    GlobalPtrStmt,
    GlobalStoreStmt,
    GlobalTemporaryLoadStmt,
    GlobalTemporaryStmt,
    GlobalTemporaryStoreStmt,
    IfStmt,
    IRModule,
    LocalLoadStmt,
    LocalStoreStmt,
    LoopIndexStmt,
    RandStmt,
    RangeForStmt,
    ReturnStmt,
    Stmt,
    TextureFunctionKind,
    TextureFunctionStmt,
    UnaryOpStmt,
    UnaryOpType,
    VertexForStmt,
    VertexInputStmt,
    VertexOutputStmt,
    WhileControlStmt,
    WhileStmt,
} from '../Stmt'
import { IRVisitor } from '../Visitor'

function str(stmt: Stmt) {
    return `%${stmt.id}`
}

function typeName(type: PrimitiveType) {
    switch (type) {
        case PrimitiveType.i32:
            return 'i32'
        case PrimitiveType.f32:
            return 'f32'
        default: {
            error('unrecognized type')
            return 'error-type'
        }
    }
}

class IRPrinter extends IRVisitor {
    sb = new StringBuilder()
    override visitConstStmt(stmt: ConstStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = const ${stmt.val}`)
    }
    override visitRangeForStmt(stmt: RangeForStmt) {
        this.write(`${str(stmt)} = for range(${str(stmt)}) {`)
        this.indent()
        this.visitBlock(stmt.body)
        this.dedent()
        this.write('}')
    }
    override visitLoopIndexStmt(stmt: LoopIndexStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = loop index of ${str(stmt.getLoop())}`)
    }
    override visitAllocaStmt(stmt: AllocaStmt) {
        this.write(`${str(stmt)} = alloca ${typeName(stmt.allocatedType)}`)
    }
    override visitLocalLoadStmt(stmt: LocalLoadStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = local load ${str(stmt.getPointer())}`)
    }
    override visitLocalStoreStmt(stmt: LocalStoreStmt) {
        this.write(`local store ${str(stmt.getPointer())} <- ${str(stmt.getValue())}`)
    }
    override visitGlobalPtrStmt(stmt: GlobalPtrStmt) {
        let indices = '[' + stmt.getIndices().map(str).join(', ') + ']'
        this.write(`${str(stmt)} = global pointer, indices ${indices}`)
    }
    override visitGlobalLoadStmt(stmt: GlobalLoadStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = global load ${str(stmt.getPointer())}`)
    }
    override visitGlobalStoreStmt(stmt: GlobalStoreStmt) {
        this.write(`global store ${str(stmt.getPointer())} <- ${str(stmt.getValue())}`)
    }
    override visitGlobalTemporaryStmt(stmt: GlobalTemporaryStmt) {
        this.write(`${str(stmt)} = gtemp ${stmt.offset} : ${typeName(stmt.type)}`)
    }
    override visitGlobalTemporaryLoadStmt(stmt: GlobalTemporaryLoadStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = gtemp load ${str(stmt.getPointer())}`)
    }
    override visitGlobalTemporaryStoreStmt(stmt: GlobalTemporaryStoreStmt) {
        this.write(`gtemp store ${str(stmt.getPointer())} <- ${str(stmt.getValue())}`)
    }
    override visitBinaryOpStmt(stmt: BinaryOpStmt) {
        let f = () => {
            switch (stmt.op) {
                case BinaryOpType.mul:
                    return 'mul'
                case BinaryOpType.add:
                    return 'add'
                case BinaryOpType.sub:
                    return 'sub'
                case BinaryOpType.truediv:
                    return 'truediv'
                case BinaryOpType.floordiv:
                    return 'floordiv'
                case BinaryOpType.mod:
                    return 'mod'
                case BinaryOpType.max:
                    return 'max'
                case BinaryOpType.min:
                    return 'min'
                case BinaryOpType.bit_and:
                    return 'bit_and'
                case BinaryOpType.bit_or:
                    return 'bit_or'
                case BinaryOpType.bit_xor:
                    return 'bit_xor'
                case BinaryOpType.bit_shl:
                    return 'bit_shl'
                case BinaryOpType.bit_shr:
                    return 'bit_shr'
                case BinaryOpType.bit_sar:
                    return 'bit_sar'
                case BinaryOpType.cmp_lt:
                    return 'cmp_lt'
                case BinaryOpType.cmp_le:
                    return 'cmp_le'
                case BinaryOpType.cmp_gt:
                    return 'cmp_gt'
                case BinaryOpType.cmp_ge:
                    return 'cmp_ge'
                case BinaryOpType.cmp_eq:
                    return 'cmp_eq'
                case BinaryOpType.cmp_ne:
                    return 'cmp_ne'
                case BinaryOpType.atan2:
                    return 'atan2'
                case BinaryOpType.pow:
                    return 'pow'
                case BinaryOpType.logical_or:
                    return 'logical_or'
                case BinaryOpType.logical_and:
                    return 'logical_and'
            }
        }
        this.write(
            `${str(stmt)} : ${typeName(stmt.getReturnType())} = binary op ${f()} ${str(stmt.getLeft())} ${str(
                stmt.getRight()
            )}`
        )
    }
    override visitUnaryOpStmt(stmt: UnaryOpStmt) {
        let f = () => {
            switch (stmt.op) {
                case UnaryOpType.neg:
                    return 'neg'
                case UnaryOpType.sqrt:
                    return 'sqrt'
                case UnaryOpType.round:
                    return 'round'
                case UnaryOpType.floor:
                    return 'floor'
                case UnaryOpType.ceil:
                    return 'ceil'
                case UnaryOpType.cast_i32_value:
                    return 'cast_i32_value'
                case UnaryOpType.cast_f32_value:
                    return 'cast_f32_value'
                case UnaryOpType.cast_i32_bits:
                    return 'cast_i32_bits'
                case UnaryOpType.cast_f32_bits:
                    return 'cast_f32_bits'
                case UnaryOpType.abs:
                    return 'abs'
                case UnaryOpType.sgn:
                    return 'sgn'
                case UnaryOpType.sin:
                    return 'sin'
                case UnaryOpType.asin:
                    return 'asin'
                case UnaryOpType.cos:
                    return 'cos'
                case UnaryOpType.acos:
                    return 'acos'
                case UnaryOpType.tan:
                    return 'tan'
                case UnaryOpType.tanh:
                    return 'tanh'
                case UnaryOpType.inv:
                    return 'inv'
                case UnaryOpType.rcp:
                    return 'rcp'
                case UnaryOpType.exp:
                    return 'exp'
                case UnaryOpType.log:
                    return 'log'
                case UnaryOpType.rsqrt:
                    return 'rsqrt'
                case UnaryOpType.bit_not:
                    return 'bit_not'
                case UnaryOpType.logic_not:
                    return 'logic_not'
            }
        }
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = unary op ${f()} ${str(stmt.getOperand())}`)
    }
    override visitWhileStmt(stmt: WhileStmt) {
        this.write(`${str(stmt)} = while true {`)
        this.indent()
        this.visitBlock(stmt.body)
        this.dedent()
        this.write('}')
    }
    override visitIfStmt(stmt: IfStmt) {
        this.write(`${str(stmt)} = if(${str(stmt.getCondition())}){`)
        this.indent()
        this.visitBlock(stmt.trueBranch)
        this.dedent()
        this.write('}')
        this.write('else {')
        this.indent()
        this.visitBlock(stmt.falseBranch)
        this.dedent()
        this.write('}')
    }
    override visitWhileControlStmt(stmt: WhileControlStmt) {
        this.write('break;')
    }
    override visitContinueStmt(stmt: ContinueStmt) {
        this.write('continue;')
    }
    override visitArgLoadStmt(stmt: ArgLoadStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = arg load ${stmt.argId}`)
    }
    override visitRandStmt(stmt: RandStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = random`)
    }
    override visitReturnStmt(stmt: ReturnStmt) {
        let values = '[' + stmt.getValues().map(str).join(', ') + ']'
        this.write(`return ${values}`)
    }
    override visitAtomicOpStmt(stmt: AtomicOpStmt) {
        let f = () => {
            switch (stmt.op) {
                case AtomicOpType.add:
                    return 'add'
                case AtomicOpType.sub:
                    return 'sub'
                case AtomicOpType.max:
                    return 'max'
                case AtomicOpType.min:
                    return 'min'
                case AtomicOpType.bit_and:
                    return 'bit_and'
                case AtomicOpType.bit_or:
                    return 'bit_or'
                case AtomicOpType.bit_xor:
                    return 'bit_xor'
            }
        }
        this.write(
            `${str(stmt)} : ${typeName(stmt.getReturnType())} = atomic op ${f()}, dest ${str(
                stmt.getDestination()
            )}, operand ${str(stmt.getOperand())}`
        )
    }
    override visitAtomicLoadStmt(stmt: AtomicLoadStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = atomic load, ptr ${str(stmt.getPointer())}`)
    }
    override visitAtomicStoreStmt(stmt: AtomicStoreStmt) {
        this.write(
            `${str(stmt)} : ${typeName(stmt.getReturnType())} = atomic store, ptr ${str(stmt.getPointer())}, val ${str(
                stmt.getValue()
            )}`
        )
    }

    override visitVertexForStmt(stmt: VertexForStmt) {
        this.write(`${str(stmt)} = vertex for {`)
        this.indent()
        this.visitBlock(stmt.body)
        this.dedent()
        this.write('}')
    }
    override visitFragmentForStmt(stmt: FragmentForStmt) {
        this.write(`${str(stmt)} = fragment for {`)
        this.indent()
        this.visitBlock(stmt.body)
        this.dedent()
        this.write('}')
    }
    override visitVertexInputStmt(stmt: VertexInputStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = vertex input ${stmt.location}`)
    }
    override visitVertexOutputStmt(stmt: VertexOutputStmt) {
        this.write(`vertex output location=${stmt.location} ${stmt.getValue()}`)
    }
    override visitFragmentInputStmt(stmt: FragmentInputStmt) {
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = fragment input ${stmt.location}`)
    }
    override visitBuiltInOutputStmt(stmt: BuiltInOutputStmt) {
        let f = () => {
            switch (stmt.builtinKind) {
                case BuiltInOutputKind.Color:
                    return 'color'
                case BuiltInOutputKind.FragDepth:
                    return 'FragDepth'
                case BuiltInOutputKind.Position:
                    return 'position'
            }
        }
        let values = '[' + stmt.getValues().map(str).join(', ') + ']'
        this.write(`built-in output ${f()} location=${stmt.location} ${values}`)
    }
    override visitBuiltInInputStmt(stmt: BuiltInInputStmt) {
        let f = () => {
            switch (stmt.builtinKind) {
                case BuiltInInputKind.InstanceIndex:
                    return 'instance index'
                case BuiltInInputKind.VertexIndex:
                    return 'vert index'
            }
        }
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = built-in input ${f()}`)
    }
    override visitFragmentDerivativeStmt(stmt: FragmentDerivativeStmt) {
        let f = () => {
            switch (stmt.direction) {
                case FragmentDerivativeDirection.x:
                    return 'x'
                case FragmentDerivativeDirection.y:
                    return 'y'
            }
        }
        this.write(`${str(stmt)} : ${typeName(stmt.getReturnType())} = d(${stmt.getValue()})d${f()}`)
    }
    override visitDiscardStmt(stmt: DiscardStmt) {
        this.write(`discard;`)
    }
    override visitTextureFunctionStmt(stmt: TextureFunctionStmt) {
        let f = () => {
            switch (stmt.func) {
                case TextureFunctionKind.Load:
                    return 'load'
                case TextureFunctionKind.Store:
                    return 'store'
                case TextureFunctionKind.Sample:
                    return 'sample'
                case TextureFunctionKind.SampleLod:
                    return 'sample-lod'
            }
        }
        let coords = '[' + stmt.getCoordinates().map(str).join(', ') + ']'
        let operands = '[' + stmt.getAdditionalOperands().map(str).join(', ') + ']'
        this.write(`${str(stmt)} = texture ${f()} ${coords} ${operands}`)
    }
    override visitCompositeExtractStmt(stmt: CompositeExtractStmt) {
        this.write(
            `${str(stmt)} : ${typeName(stmt.getReturnType())} = composite extract ${
                stmt.elementIndex
            } ${stmt.getComposite()}`
        )
    }

    indentation = 0
    indent() {
        this.indentation += 1
    }
    dedent() {
        this.indentation -= 1
    }
    write(...args: (string | number)[]) {
        this.sb.write('  '.repeat(this.indentation), ...args, '\n')
    }
}

export function stringifyIR(module: IRModule) {
    let printer = new IRPrinter()
    printer.visitModule(module)
    return printer.sb.getString()
}
