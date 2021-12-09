import {Field} from './Field'

class SNodeTree {
    treeId: number = 0
    fields: Field[] = []
    size: number = 0
    addField(fieldSize: number) : Field{
        let field:Field = {
            snodeTree: this,
            offset: this.size,
            size: fieldSize
        }
        this.size += fieldSize
        this.fields.push(field)
        return field
    }
}

export {SNodeTree}