import { ResourceBinding, ResourceInfo, ResourceType } from "../../runtime/Kernel";
import { assert, error } from "../../utils/Logging";
import { PrimitiveType } from "../frontend/Type";
import { ConstStmt, Stmt } from "../ir/Stmt";
import { IRVisitor } from "../ir/Visitor";
import { OffloadedModule, OffloadType } from "./Offload";

export interface CodegenResult {
    code: string
}



class ResourceBindingMap {
    bindings: ResourceBinding[] = []
    has(resource: ResourceInfo) {
        for (let b of this.bindings) {
            if (b.info.equals(resource)) {
                return true
            }
        }
        return false
    }
    add(resource: ResourceInfo, bindingPoint: number) {
        let binding = new ResourceBinding(resource, bindingPoint)
        this.bindings.push(binding)
    }
    get(resource: ResourceInfo) {
        for (let b of this.bindings) {
            if (b.info.equals(resource)) {
                return b.binding!
            }
        }
        return undefined
    }
    size() {
        return this.bindings.length
    }
}

class StringBuilder {
    parts: string[] = []
    write(...args: (string | number)[]) {
        for (let a of args) {
            this.parts.push(a.toString())
        }
    }
    getString() {
        return this.parts.join()
    }
}

class PointerInfo {
    isRoot: boolean = false
    rootId: number | null = null
}

export class CodegenVisitor extends IRVisitor {
    constructor(public offload: OffloadedModule, public bindingPointBegin = 0) {
        super()
    }

    override visitConstStmt(stmt: ConstStmt): void {
        let dt = stmt.getReturnType()
        let val = stmt.val
        this.emitLet(stmt.getName(), this.getPrimitiveTypeName(dt))
        switch (dt) {
            case PrimitiveType.f32: {
                let s = val.toPrecision(8)
                if (!s.includes(".") && !s.includes("e") && !s.includes("E")) {
                    s += ".f"
                }
                this.body.write(s)
            }
            case PrimitiveType.i32: {
                assert(Number.isInteger(val), "expecting integer")
                this.body.write(val.toString())
            }
            default: {
                error("unrecognized return type ", stmt)
            }
        }
        this.body.write(";\n")
    }

    globalDecls = new StringBuilder

    stageInStructBegin = new StringBuilder
    stageInStructBody = new StringBuilder
    stageInStructEnd = new StringBuilder

    stageOutStructBegin = new StringBuilder
    stageOutStructBody = new StringBuilder
    stageOutStructEnd = new StringBuilder

    funtionSignature = new StringBuilder
    functionBodyPrologue = new StringBuilder
    body = new StringBuilder
    functionBodyEpilogue = new StringBuilder
    functionEnd = new StringBuilder

    assembleShader() {
        return (
            this.globalDecls.getString() +
            this.stageInStructBegin.getString() +
            this.stageInStructBody.getString() +
            this.stageInStructEnd.getString() +

            this.stageOutStructBegin.getString() +
            this.stageOutStructBody.getString() +
            this.stageOutStructEnd.getString() +

            this.funtionSignature.getString() +
            this.functionBodyPrologue.getString() +
            this.body.getString() +
            this.functionBodyEpilogue.getString() +
            this.functionEnd.getString()
        )
    }

    bodyIndentCount = 1;
    indent() {
        this.bodyIndentCount++;
    }
    dedent() {
        this.bodyIndentCount--;
    }
    getIndentation() {
        return "  ".repeat(this.bodyIndentCount)
    }

    emitLet(name: string, type: string) {
        this.body.write(this.getIndentation(), `let ${name} : ${type} = `)
    }

    emitVar(name: string, type: string) {
        this.body.write(this.getIndentation(), `var ${name} : ${type} = `)
    }

    getPointerIntTypeName() {
        return "i32"
    }

    getPrimitiveTypeName(dt: PrimitiveType) {
        switch (dt) {
            case PrimitiveType.f32:
                return "f32"
            case PrimitiveType.i32:
                return "i32"
            default:
                error(`unsupported primitive type `, dt)
                return "error"
        }
    }

    getScalarOrVectorTypeName(dt: PrimitiveType, numComponents: number) {
        let primName = this.getPrimitiveTypeName(dt)
        let typeName = primName
        if (numComponents > 1) {
            typeName = `vec${numComponents}<${primName}>`
        }
        return typeName
    }

    getScalarOrVectorExpr(values: Stmt[], typeName: string) {
        let outputExpr = values[0].getName()
        if (values.length > 1) {
            outputExpr = `${typeName}(${values[0].getName()}`
            for (let i = 1; i < values.length; ++i) {
                outputExpr += `, ${values[i].getName()}`
            }
            outputExpr += ")"
        }
        return outputExpr
    }

    getElementCount(buffer:ResourceInfo){
        switch(buffer.resourceType){
            
        }
    }

    resourceBindings: ResourceBindingMap = new ResourceBindingMap

    getBufferName(buffer: ResourceInfo) {
        let name = ""
        let elementType = this.getRawDataTypeName()
        switch (buffer.resourceType) {
            case ResourceType.Root: {
                name = "root_buffer_" + buffer.resourceID!.toString() + "_";
                break;
            }
            case ResourceType.RootAtomic: {
                name = "root_buffer_" + buffer.resourceID!.toString() + "_atomic_";
                elementType = "atomic<i32>";
                break;
            }
            case ResourceType.GlobalTmps: {
                name = "global_tmps_";
                break;
            }
            case ResourceType.RandStates: {
                name = "rand_states_";
                elementType = "RandState";
                break;
            }
            case ResourceType.Args: {
                name = "args_";
                break;
            }
            case ResourceType.Rets: {
                name = "rets_";
                break;
            }
            default: {
                error("not a buffer")
            }
        }
        if(!this.resourceBindings.has(buffer)){
            let binding = this.bindingPointBegin + this.resourceBindings.size()
            this.resourceBindings.add(buffer, binding)

        }
        return name
    }

    getBufferMemberName(buffer: ResourceInfo) {
        return this.getBufferName(buffer) + ".name"
    }


    randInitiated = false
    initRand() {
        if (this.randInitiated) {
            return
        }
        let structDecl = `
struct RandState{
    x: u32,
    y: u32,
    z: u32,
    w: u32,
};
`
        this.globalDecls.write(structDecl)

    }


    isVertexFor() {
        return this.offload.type === OffloadType.Vertex
    }

    isFragmentFor() {
        return this.offload.type === OffloadType.Fragment
    }

    enforce16BytesAlignment() {
        return this.isVertexFor() || this.isFragmentFor()
    }

    getRawDataTypeName() {
        if (!this.enforce16BytesAlignment()) {
            return "i32"
        }
        else {
            return "vec4<i32>"
        }
    }
}

