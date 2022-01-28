import {Runtime} from '../backend/Runtime'
import {SNodeTree} from './SNodeTree'
import {getTaichiModule, NativeTaichiAny} from '../native/taichi/GetTaichi'
class Program {
    runtime: Runtime|null = null
    materializedTrees: SNodeTree[] = []
    partialTree: SNodeTree
    constructor(){
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = 0
    }

    private nativeTaichi : NativeTaichiAny
    private nativeProgram : NativeTaichiAny

    async init(){
        this.nativeTaichi = await getTaichiModule()
        this.nativeProgram = new this.nativeTaichi.Program(this.nativeTaichi.Arch.vulkan)
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