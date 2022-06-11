import { Field } from "../../data/Field";
import { TextureBase } from "../../data/Texture";
import { PrimitiveType } from "../frontend/Type";
import { AllocaStmt, ArgLoadStmt, AtomicOpStmt, AtomicOpType, BinaryOpStmt, BinaryOpType, Block, BuiltinInputKind, BuiltInInputStmt, BuiltInOutputKind, BuiltInOutputStmt, CompositeExtractStmt, ConstStmt, ContinueStmt, DiscardStmt, FragmentDerivativeStmt, FragmentForStmt, FragmentInputStmt, GlobalLoadStmt, GlobalPtrStmt, GlobalStoreStmt, GlobalTemporaryLoadStmt, GlobalTemporaryStmt, GlobalTemporaryStoreStmt, IfStmt, LocalLoadStmt, LocalStoreStmt, LoopIndexStmt, RandStmt, RangeForStmt, ReturnStmt, Stmt, TextureFunctionKind, TextureFunctionStmt, UnaryOpStmt, UnaryOpType, VertexForStmt, VertexInputStmt, VertexOutputStmt, WhileControlStmt, WhileStmt } from "./Stmt";

// designed to have the same API as native taichi's IRBuilder
// which is why there're some camel_case and camelCase mash-ups

export class IRBuilder {
    constructor() {

    }

    stmts: Stmt[] = []
    guards: Guard[] = [new Guard(this, this.stmts)]

    get_int32(val: number) {
        return this.pushNewStmt(new ConstStmt(val, PrimitiveType.i32, this.getNewId()))
    }
    get_float32(val: number) {
        return this.pushNewStmt(new ConstStmt(val, PrimitiveType.f32, this.getNewId()))
    }

    create_range_for(range: Stmt, shouldStrictlySerialize: boolean) {
        return this.pushNewStmt(new RangeForStmt(range, shouldStrictlySerialize, new Block, this.getNewId()))
    }

    get_loop_index(loop: Stmt) {
        return this.pushNewStmt(new LoopIndexStmt(loop, this.getNewId()))
    }

    create_global_ptr(field: Field, indices: number[], elementOffset: number) {
        return this.pushNewStmt(new GlobalPtrStmt(field, indices, elementOffset, this.getNewId()))
    }

    create_global_load(ptr: GlobalPtrStmt) {
        return this.pushNewStmt(new GlobalLoadStmt(ptr, this.getNewId()))
    }

    create_global_store(ptr: GlobalPtrStmt, val: Stmt) {
        return this.pushNewStmt(new GlobalStoreStmt(ptr, val, this.getNewId()))
    }

    create_global_temporary(type:PrimitiveType, offset: number) {
        return this.pushNewStmt(new GlobalTemporaryStmt(type,offset, this.getNewId()))
    }

    create_global_temporary_load(ptr: GlobalTemporaryStmt) {
        return this.pushNewStmt(new GlobalTemporaryLoadStmt(ptr, this.getNewId()))
    }

    create_global_temporary_store(ptr: GlobalTemporaryStmt, val: Stmt) {
        return this.pushNewStmt(new GlobalTemporaryStoreStmt(ptr, val, this.getNewId()))
    }

    create_local_var(type: PrimitiveType) {
        return this.pushNewStmt(new AllocaStmt(type, this.getNewId()))
    }

    create_local_load(ptr: AllocaStmt) {
        return this.pushNewStmt(new LocalLoadStmt(ptr, this.getNewId()))
    }

    create_local_store(ptr: AllocaStmt, val: Stmt) {
        return this.pushNewStmt(new LocalStoreStmt(ptr, val, this.getNewId()))
    }

    create_mul(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.mul, this.getNewId()))
    }

    create_add(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.add, this.getNewId()))
    }

    create_sub(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.sub, this.getNewId()))
    }

    create_truediv(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.truediv, this.getNewId()))
    }

    create_floordiv(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.floordiv, this.getNewId()))
    }

    create_div(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.div, this.getNewId()))
    }

    create_mod(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.mod, this.getNewId()))
    }

    create_max(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.max, this.getNewId()))
    }

    create_min(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.min, this.getNewId()))
    }

    create_bit_and(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_and, this.getNewId()))
    }

    create_bit_or(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_or, this.getNewId()))
    }

    create_bit_xor(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_xor, this.getNewId()))
    }

    create_bit_shl(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_shl, this.getNewId()))
    }

    create_bit_shr(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_shr, this.getNewId()))
    }

    create_bit_sar(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.bit_sar, this.getNewId()))
    }

    create_cmp_lt(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_lt, this.getNewId()))
    }

    create_cmp_le(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_le, this.getNewId()))
    }

    create_cmp_gt(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_gt, this.getNewId()))
    }

    create_cmp_ge(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_ge, this.getNewId()))
    }

    create_cmp_eq(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_eq, this.getNewId()))
    }

    create_cmp_ne(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.cmp_ne, this.getNewId()))
    }

    create_atan2(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.atan2, this.getNewId()))
    }

    create_pow(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.pow, this.getNewId()))
    }

    create_logical_or(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.logical_or, this.getNewId()))
    }

    create_logical_and(lhs: Stmt, rhs: Stmt) {
        return this.pushNewStmt(new BinaryOpStmt(lhs, rhs, BinaryOpType.logical_and, this.getNewId()))
    }

    create_neg(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.neg, this.getNewId()))
    }

    create_sqrt(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.sqrt, this.getNewId()))
    }

    create_round(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.round, this.getNewId()))
    }

    create_floor(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.floor, this.getNewId()))
    }

    create_ceil(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.ceil, this.getNewId()))
    }

    create_cast_i32_value(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.cast_i32_value, this.getNewId()))
    }

    create_cast_f32_value(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.cast_f32_value, this.getNewId()))
    }

    create_cast_i32_bits(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.cast_i32_bits, this.getNewId()))
    }

    create_cast_f32_bits(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.cast_f32_bits, this.getNewId()))
    }

    create_abs(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.abs, this.getNewId()))
    }

    create_sgn(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.sgn, this.getNewId()))
    }

    create_sin(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.sin, this.getNewId()))
    }

    create_asin(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.asin, this.getNewId()))
    }

    create_cos(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.cos, this.getNewId()))
    }

    create_acos(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.acos, this.getNewId()))
    }

    create_tan(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.tan, this.getNewId()))
    }

    create_tanh(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.tanh, this.getNewId()))
    }

    create_inv(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.inv, this.getNewId()))
    }

    create_rcp(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.rcp, this.getNewId()))
    }

    create_exp(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.exp, this.getNewId()))
    }

    create_log(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.log, this.getNewId()))
    }

    create_rsqrt(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.rsqrt, this.getNewId()))
    }

    create_bit_not(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.bit_not, this.getNewId()))
    }

    create_logic_not(operand: Stmt) {
        return this.pushNewStmt(new UnaryOpStmt(operand, UnaryOpType.logic_not, this.getNewId()))
    }

    create_atomic_add(dest: Stmt, val: Stmt) {
        return this.pushNewStmt(new AtomicOpStmt(AtomicOpType.add, dest, val, this.getNewId()))
    }

    create_atomic_sub(dest: Stmt, val: Stmt) {
        return this.pushNewStmt(new AtomicOpStmt(AtomicOpType.sub, dest, val, this.getNewId()))
    }

    create_atomic_max(dest: Stmt, val: Stmt) {
        return this.pushNewStmt(new AtomicOpStmt(AtomicOpType.max, dest, val, this.getNewId()))
    }

    create_atomic_min(dest: Stmt, val: Stmt) {
        return this.pushNewStmt(new AtomicOpStmt(AtomicOpType.min, dest, val, this.getNewId()))
    }

    create_while_true() {
        return this.pushNewStmt(new WhileStmt(new Block, this.getNewId()))
    }

    create_if(cond: Stmt) {
        return this.pushNewStmt(new IfStmt(cond, new Block, new Block, this.getNewId()))
    }

    create_break() {
        return this.pushNewStmt(new WhileControlStmt(this.getNewId()))
    }

    create_continue() {
        return this.pushNewStmt(new ContinueStmt(this.getNewId()))
    }

    create_argload(type: PrimitiveType, argId: number) {
        return this.pushNewStmt(new ArgLoadStmt(type, argId, this.getNewId()))
    }

    create_rand(type: PrimitiveType) {
        return this.pushNewStmt(new RandStmt(type, this.getNewId()))
    }

    create_return(val: Stmt) {
        return this.pushNewStmt(new ReturnStmt([val], this.getNewId()))
    }

    create_return_vec(vals: Stmt[]) {
        return this.pushNewStmt(new ReturnStmt(vals, this.getNewId()))
    }

    create_vertex_input(type: PrimitiveType, location: number) {
        return this.pushNewStmt(new VertexInputStmt(type, location, this.getNewId()))
    }

    create_vertex_output(val: Stmt, location: number) {
        return this.pushNewStmt(new VertexOutputStmt(val, location, this.getNewId()))
    }

    create_position_output(vals: Stmt[]) {
        return this.pushNewStmt(new BuiltInOutputStmt(vals, BuiltInOutputKind.Position, this.getNewId()))
    }

    create_fragment_input(type: PrimitiveType, location: number) {
        return this.pushNewStmt(new FragmentInputStmt(type, location, this.getNewId()))
    }

    create_color_output(vals: Stmt[]) {
        return this.pushNewStmt(new BuiltInOutputStmt(vals, BuiltInOutputKind.Color, this.getNewId()))
    }

    create_vertex_for() {
        return this.pushNewStmt(new VertexForStmt(new Block, this.getNewId()))
    }

    create_fragment_for() {
        return this.pushNewStmt(new FragmentForStmt(new Block, this.getNewId()))
    }

    create_discard() {
        return this.pushNewStmt(new DiscardStmt(this.getNewId()))
    }

    create_depth_output(val: Stmt) {
        return this.pushNewStmt(new BuiltInOutputStmt([val], BuiltInOutputKind.FragDepth, this.getNewId()))
    }

    create_texture_sample(texture: TextureBase, coords: Stmt[]) {
        return this.pushNewStmt(new TextureFunctionStmt(texture, TextureFunctionKind.Sample, coords, [], this.getNewId()))
    }

    create_texture_sample_lod(texture: TextureBase, coords: Stmt[], lod: Stmt) {
        return this.pushNewStmt(new TextureFunctionStmt(texture, TextureFunctionKind.SampleLod, coords, [lod], this.getNewId()))
    }

    create_texture_load(texture: TextureBase, coords: Stmt[]) {
        return this.pushNewStmt(new TextureFunctionStmt(texture, TextureFunctionKind.Load, coords, [], this.getNewId()))
    }

    create_texture_store(texture: TextureBase, coords: Stmt[], vals: Stmt[]) {
        return this.pushNewStmt(new TextureFunctionStmt(texture, TextureFunctionKind.Store, coords, vals, this.getNewId()))
    }

    create_composite_extract(composite: Stmt, index: number) {
        return this.pushNewStmt(new CompositeExtractStmt(composite, index, this.getNewId()))
    }

    create_vertex_index_input() {
        return this.pushNewStmt(new BuiltInInputStmt(BuiltinInputKind.VertexIndex, this.getNewId()))
    }

    create_instance_index_input() {
        return this.pushNewStmt(new BuiltInInputStmt(BuiltinInputKind.InstanceIndex, this.getNewId()))
    }

    create_dpdx(val: Stmt) {
        return this.pushNewStmt(new FragmentDerivativeStmt(val, this.getNewId()))
    }

    create_dpdy(val: Stmt) {
        return this.pushNewStmt(new FragmentDerivativeStmt(val, this.getNewId()))
    }

    get_range_loop_guard(loop:RangeForStmt){
        return this.addGuard(loop.body.stmts)
    }

    get_while_loop_guard(loop:WhileStmt){
        return this.addGuard(loop.body.stmts)
    }

    get_vertex_loop_guard(loop:VertexForStmt){
        return this.addGuard(loop.body.stmts)
    }

    get_fragment_loop_guard(loop:FragmentForStmt){
        return this.addGuard(loop.body.stmts)
    }

    get_if_guard(stmt:IfStmt, branch:boolean){
        if(branch){
            return this.addGuard(stmt.trueBranch.stmts)
        }
        else{
            return this.addGuard(stmt.falseBranch.stmts)
        }
    }

    getNewId() {
        return this.stmts.length
    }

    pushNewStmt(stmt: Stmt) {
        this.guards.at(-1)!.stmts.push(stmt)
        return stmt
    }

    addGuard(stmts:Stmt[]){
        let guard = new Guard(this, stmts)
        this.guards.push(guard)
        return guard
    }
}

export class Guard {
    constructor(public irBuilder: IRBuilder, public stmts: Stmt[]) {

    }
    delete(){
        this.irBuilder.guards.pop()
    }
}