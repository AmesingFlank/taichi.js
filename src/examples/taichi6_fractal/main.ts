//@ts-nocheck
import {ti} from "../../taichi" 
import {Program} from '../../program/Program'

async function taichiExample6Fractal(canvas:HTMLCanvasElement): Promise<boolean> {
    console.log("taichiExample6Fractal")
     
    await ti.init() 

    let n = 320

    let pixels = ti.Vector.field(4, ti.f32,[2*n, n])

    let complex_sqr = (z) => {
        return [z[0]**2 - z[1]**2, z[1] * z[0] * 2]
    }

    let norm = (z) => {
        return sqrt(z[0]*z[0]+z[1]*z[1]) // sqrt is builtin, but norm isn't yet. lol
    }

    ti.addToKernelScope({pixels, n, complex_sqr, norm}) 

    let kernel = ti.kernel(
        (t) => {
            //@ts-ignore
            for(let I of ndrange(n*2,n)){
                let i = I[0]
                let j = I[1]
                let c = [-0.8, cos(t) * 0.2]
                let z = [i / n - 1, j / n - 0.5] * 2
                let iterations = 0
                while( norm(z) < 20 && iterations < 50 ){
                    z = complex_sqr(z) + c
                    iterations = iterations + 1
                }
                pixels[i,j] = 1 - iterations * 0.02
                pixels[i,j][3] = 1
            }
        }
    )

    let program = Program.getCurrentProgram()
    let renderer = await program.runtime!.getRootBufferRenderer(canvas,pixels.snodeTree.treeId)
 
    let i = 0
    async function frame() {
        kernel(i * 0.03)
        i = i + 1
        await ti.sync()
        await renderer.render(2*n, n)
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

export {taichiExample6Fractal}