import { Type, PrimitiveType } from "./Type";
import { Stmt } from "../ir/Stmt";
export declare class Value {
    stmts: Stmt[];
    compileTimeConstants: number[];
    constructor(type: Type, stmts?: Stmt[], // CHI IR Stmts
    compileTimeConstants?: number[]);
    hostSideValue: any;
    private type_;
    getType(): Type;
    isCompileTimeConstant(): boolean;
}
export declare class ValueUtils {
    static makeScalar(stmt: Stmt, primitiveType: PrimitiveType): Value;
    static makeConstantScalar(val: number, stmt: Stmt, primitiveType: PrimitiveType): Value;
    static getVectorComponents(vec: Value): Value[];
    static getMatrixComponents(mat: Value): Value[][];
    static getMatrixRowVectors(mat: Value): Value[];
    static getMatrixColVectors(mat: Value): Value[];
    static makeVectorFromScalars(values: Value[]): Value;
    static makeMatrixFromVectorsAsRows(values: Value[]): Value;
    static makeMatrixFromVectorsAsCols(values: Value[]): Value;
    static makeMatrixFromScalars(values: Value[][]): Value;
    static transposeMatrix(mat: Value): Value;
    static addScalarToVector(vector: Value, scalar: Value): Value;
    static concatVectors(v0: Value, v1: Value): Value;
    static concatMatrices(m0: Value, m1: Value): Value;
    static addRowVectorToMatrix(matrix: Value, vector: Value): Value;
    static makeStruct(keys: string[], valuesMap: Map<string, Value>): Value;
    static getStructMembers(structValue: Value): Map<string, Value>;
    static makeHostObjectReference(val: any, markedAsStatic?: boolean): Value;
}
