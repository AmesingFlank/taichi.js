import {Runtime} from '../backend/Runtime'
import {SNodeTree} from './SNodeTree'
import {nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi'
import {error} from '../utils/Logging'
class Program {
    runtime: Runtime|null = null
    materializedTrees: SNodeTree[] = []
    partialTree: SNodeTree

    private static instance: Program
    private constructor(){
        this.nativeProgram = new nativeTaichi.Program(nativeTaichi.Arch.vulkan)
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = 0
    }
    
    public static getCurrentProgram(): Program{
        if(!Program.instance){
            Program.instance = new Program()
        }
        return Program.instance
    }

    nativeProgram : NativeTaichiAny

    async materializeRuntime(){
        if(!this.runtime){
            this.runtime = new Runtime()
            await this.runtime.init()
        }
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
  
export {Program}