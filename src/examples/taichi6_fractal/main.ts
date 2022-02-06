//@ts-nocheck
import {ti} from "../../taichi" 
import {Program} from '../../program/Program'

async function taichiExample6Fractal(canvas:HTMLCanvasElement): Promise<boolean> {
    console.log("taichiExample6Fractal")
     
    await ti.init() 

    let n = 320

    let pixels = ti.Vector.field(4, ti.f32,[2*n, n])
    ti.addToKernelScope({pixels, n}) 

    let kernel = ti.kernel(
        function k() {
            //@ts-ignore
            for(let I of ndrange(n*2,n)){
                let i = I[0]
                let j = I[1]
                pixels[i,j] = [1,0,0,1] / (2*n)
            }
        }
    )

    let program = Program.getCurrentProgram()
    let renderer = await program.runtime!.getRootBufferRenderer(canvas,pixels.snodeTree.treeId)
 
    async function frame() {
        kernel()
        await program.runtime!.sync()
        await renderer.render(2*n, n)
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

export {taichiExample6Fractal}