import { Field } from "../../data/Field";
import { TextureBase } from "../../data/Texture";
import { PrimitiveType } from "../frontend/Type";
import { AllocaStmt, ArgLoadStmt, AtomicOpStmt, AtomicOpType, BinaryOpStmt, BinaryOpType, Block, BuiltInInputStmt, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, DiscardStmt, FragmentDerivativeStmt, FragmentForStmt, FragmentInputStmt, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, GlobalTemporaryStoreStmt, IfStmt, IRModule, LocalLoadStmt, LocalStoreStmt, LoopIndexStmt, PointerStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, TextureFunctionStmt, UnaryOpStmt, UnaryOpType, VertexForStmt, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "./Stmt";
export declare class IRBuilder {
    constructor();
    module: IRModule;
    guards: Guard[];
    get_int32(val: number): ConstStmt;
    get_float32(val: number): ConstStmt;
    create_range_for(range: Stmt, shouldStrictlySerialize: boolean): RangeForStmt;
    get_loop_index(loop: Stmt): LoopIndexStmt;
    create_global_ptr(field: Field, indices: Stmt[], elementOffset: number): GlobalPtrStmt;
    create_global_load(ptr: GlobalPtrStmt): GlobalLoadStmt;
    create_global_store(ptr: GlobalPtrStmt, val: Stmt): GlobalStoreStmt;
    create_global_temporary(type: PrimitiveType, offset: number): GlobalTemporaryStmt;
    create_global_temporary_load(ptr: GlobalTemporaryStmt): GlobalTemporaryLoadStmt;
    create_global_temporary_store(ptr: GlobalTemporaryStmt, val: Stmt): GlobalTemporaryStoreStmt;
    create_local_var(type: PrimitiveType): AllocaStmt;
    create_local_load(ptr: AllocaStmt): LocalLoadStmt;
    create_local_store(ptr: AllocaStmt, val: Stmt): LocalStoreStmt;
    create_binary_op(lhs: Stmt, rhs: Stmt, op: BinaryOpType): BinaryOpStmt;
    create_unary_op(operand: Stmt, op: UnaryOpType): UnaryOpStmt;
    create_atomic_op(dest: PointerStmt, val: Stmt, op: AtomicOpType): AtomicOpStmt;
    create_while_true(): WhileStmt;
    create_if(cond: Stmt): IfStmt;
    create_break(): WhileControlStmt;
    create_continue(): ContinueStmt;
    create_arg_load(type: PrimitiveType, argId: number): ArgLoadStmt;
    create_rand(type: PrimitiveType): RandStmt;
    create_return(val: Stmt): ReturnStmt;
    create_return_vec(vals: Stmt[]): ReturnStmt;
    create_vertex_input(location: number, type: PrimitiveType): VertexInputStmt;
    create_vertex_output(location: number, val: Stmt): VertexOutputStmt;
    create_position_output(vals: Stmt[]): BuiltInOutputStmt;
    create_fragment_input(location: number, type: PrimitiveType): FragmentInputStmt;
    create_color_output(location: number, vals: Stmt[]): BuiltInOutputStmt;
    create_vertex_for(): VertexForStmt;
    create_fragment_for(): FragmentForStmt;
    create_discard(): DiscardStmt;
    create_depth_output(val: Stmt): BuiltInOutputStmt;
    create_texture_sample(texture: TextureBase, coords: Stmt[]): TextureFunctionStmt;
    create_texture_sample_lod(texture: TextureBase, coords: Stmt[], lod: Stmt): TextureFunctionStmt;
    create_texture_load(texture: TextureBase, coords: Stmt[]): TextureFunctionStmt;
    create_texture_store(texture: TextureBase, coords: Stmt[], vals: Stmt[]): TextureFunctionStmt;
    create_composite_extract(composite: Stmt, index: number): CompositeExtractStmt;
    create_vertex_index_input(): BuiltInInputStmt;
    create_instance_index_input(): BuiltInInputStmt;
    create_dpdx(val: Stmt): FragmentDerivativeStmt;
    create_dpdy(val: Stmt): FragmentDerivativeStmt;
    get_range_loop_guard(loop: RangeForStmt): Guard;
    get_while_loop_guard(loop: WhileStmt): Guard;
    get_vertex_loop_guard(loop: VertexForStmt): Guard;
    get_fragment_loop_guard(loop: FragmentForStmt): Guard;
    get_if_guard(stmt: IfStmt, branch: boolean): Guard;
    getNewId(): number;
    pushNewStmt<T extends Stmt>(stmt: T): T;
    addGuard(block: Block): Guard;
}
export declare class Guard {
    parent: {
        guards: Guard[];
    };
    block: Block;
    constructor(parent: {
        guards: Guard[];
    }, block: Block);
    delete(): void;
}
