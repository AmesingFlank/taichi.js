import {Runtime} from '../backend/Runtime'
import {SNodeTree} from './SNodeTree'
import {nativeTaichi, NativeTaichiAny} from '../native/taichi/GetTaichi'
import {error} from '../utils/Logging'
import {GlobalScope} from "./GlobalScope"

class Program {
    runtime: Runtime|null = null
    materializedTrees: SNodeTree[] = []
    partialTree: SNodeTree
    
    nativeProgram : NativeTaichiAny
    nativeAotBuilder: NativeTaichiAny
    globalScopeObj: GlobalScope 

    private static instance: Program
    private constructor(){
        let arch = nativeTaichi.Arch.webgpu 
        this.nativeProgram = new nativeTaichi.Program(arch)
        this.nativeAotBuilder = this.nativeProgram.make_aot_module_builder(arch);
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = 0
        this.globalScopeObj = new GlobalScope()
     }
    
    public static getCurrentProgram(): Program{
        if(!Program.instance){
            Program.instance = new Program()
        }
        return Program.instance
    }


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
        this.nativeProgram.add_snode_tree(this.partialTree.nativeTreeRoot, true)
        this.runtime!.materializeTree(this.partialTree)
        this.materializedTrees.push(this.partialTree)
        let nextId = this.partialTree.treeId + 1
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = nextId
    }

    addToKernelScope(obj: any){
        for(let name in obj){
            this.globalScopeObj.addStored(name,obj[name])
        }
    }

    private nextAnonymousKernel = 0
    getAnonymousKernelName():string {
        return "anonymous_"+(this.nextAnonymousKernel++).toString()
    }

    private nextFunction = 0
    getNextFunctionID():string {
        return "anonymous_"+(this.nextAnonymousKernel++).toString()
    }
}
  
export {Program}