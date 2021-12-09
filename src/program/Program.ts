import {Runtime} from '../backend/Runtime'
import {SNodeTree} from './SNodeTree'

class Program {
    runtime: Runtime|null = null
    materializedTrees: SNodeTree[] = []
    partialTree: SNodeTree
    constructor(){
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = 0
    }

    async materializeRuntime(){
        this.runtime = new Runtime()
        await this.runtime.init()
    }

    materializeCurrentTree(){
        if(this.partialTree.size === 0){
            return
        }
        if(this.runtime == null){
            this.materializeRuntime()
        }
        this.runtime!.materializeTree(this.partialTree)
        this.materializedTrees.push(this.partialTree)
        let nextId = this.partialTree.treeId + 1
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = nextId
    }
}

const program = new Program()

export {Program,program}