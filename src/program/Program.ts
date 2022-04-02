import { Runtime } from '../backend/Runtime'
import { SNodeTree } from '../data/SNodeTree'
import { nativeTaichi, NativeTaichiAny } from '../native/taichi/GetTaichi'
import { error } from '../utils/Logging'
import { Scope } from "./Scope"
import { DepthTexture, TextureBase, toNativeImageDimensionality } from '../data/Texture'
import { PrimitiveType, toNativePrimitiveType } from '../frontend/Type'

class Program {
    runtime: Runtime | null = null
    
    partialTree: SNodeTree

    nativeProgram: NativeTaichiAny
    nativeAotBuilder: NativeTaichiAny
    kernelScopeObj: Scope

    private static instance: Program
    private constructor() {
        let arch = nativeTaichi.Arch.webgpu
        this.nativeProgram = new nativeTaichi.Program(arch)
        this.nativeAotBuilder = this.nativeProgram.make_aot_module_builder(arch);
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = 0
        this.kernelScopeObj = new Scope()
    }

    public static getCurrentProgram(): Program {
        if (!Program.instance) {
            Program.instance = new Program()
        }
        return Program.instance
    }


    async materializeRuntime() {
        if (!this.runtime) {
            this.runtime = new Runtime()
            await this.runtime.init()
        }
    }

    materializeCurrentTree() {
        if (this.partialTree.size === 0) {
            return
        }
        if (this.runtime == null) {
            this.materializeRuntime()
        }
        this.nativeProgram.add_snode_tree(this.partialTree.nativeTreeRoot, true)
        this.runtime!.materializeTree(this.partialTree) 
        let nextId = this.partialTree.treeId + 1
        this.partialTree = new SNodeTree()
        this.partialTree.treeId = nextId
    }

    addTexture(texture: TextureBase) {
        let id = this.runtime!.textures.length
        texture.textureId = id;
        this.runtime!.addTexture(texture)

        let dim = toNativeImageDimensionality(texture.getTextureDimensionality())
        let depth = texture instanceof DepthTexture
        let format = texture.getGPUTextureFormat() as string
        let params = new nativeTaichi.TextureParams(toNativePrimitiveType(PrimitiveType.f32), dim, depth, format)
        texture.nativeTexture = this.nativeProgram.add_texture(params, true)
    }

    addToKernelScope(obj: any) {
        for (let name in obj) {
            this.kernelScopeObj.addStored(name, obj[name])
        }
    }

    private nextAnonymousKernel = 0
    getAnonymousKernelName(): string {
        return "anonymous_" + (this.nextAnonymousKernel++).toString()
    }

    private nextFunction = 0
    getNextFunctionID(): string {
        return "anonymous_" + (this.nextAnonymousKernel++).toString()
    }
}

export { Program }