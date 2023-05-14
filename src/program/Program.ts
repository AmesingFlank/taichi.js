import { Runtime } from '../runtime/Runtime';
import { SNodeTree } from '../data/SNodeTree';
import { Scope } from '../language/frontend/Scope';
import { DepthTexture, TextureBase } from '../data/Texture';
import { PrimitiveType } from '../language/frontend/Type';

export interface ProgramOptions {
    printIR: boolean;
    printWGSL: boolean;
}

class Program {
    options: ProgramOptions = {
        printIR: false,
        printWGSL: false,
    };
    async init(options?: ProgramOptions) {
        if (options && options.printIR !== undefined) {
            this.options.printIR = options.printIR;
        }
        if (options && options.printWGSL !== undefined) {
            this.options.printWGSL = options.printWGSL;
        }
        await this.materializeRuntime();
    }

    runtime: Runtime | null = null;

    partialTree: SNodeTree;

    kernelScope: Scope;

    private static instance: Program;
    private constructor() {
        this.partialTree = new SNodeTree();
        this.partialTree.treeId = 0;
        this.kernelScope = new Scope();
    }

    public static getCurrentProgram(): Program {
        if (!Program.instance) {
            Program.instance = new Program();
        }
        return Program.instance;
    }

    async materializeRuntime() {
        if (!this.runtime) {
            this.runtime = new Runtime();
            await this.runtime.init();
        }
    }

    materializeCurrentTree() {
        if (this.partialTree.size === 0) {
            return;
        }
        if (this.runtime == null) {
            this.materializeRuntime();
        }
        this.runtime!.materializeTree(this.partialTree);
        let nextId = this.partialTree.treeId + 1;
        this.partialTree = new SNodeTree();
        this.partialTree.treeId = nextId;
    }

    addTexture(texture: TextureBase) {
        let id = this.runtime!.textures.length;
        texture.textureId = id;
        this.runtime!.addTexture(texture);
    }

    addToKernelScope(obj: any) {
        for (let name in obj) {
            this.kernelScope.addStored(name, obj[name]);
        }
    }

    clearKernelScope() {
        this.kernelScope = new Scope();
    }

    private nextAnonymousKernel = 0;
    getAnonymousKernelName(): string {
        return 'anonymous_' + (this.nextAnonymousKernel++).toString();
    }

    private nextFunction = 0;
    getNextFunctionID(): string {
        return 'anonymous_' + (this.nextAnonymousKernel++).toString();
    }
}

export { Program };
