import { IRVisitor } from "../ir/Visitor";

export interface CodegenResult {
    code:string
}

export class CodegenVisitor extends IRVisitor{
    constructor(){
        super()
    }
}