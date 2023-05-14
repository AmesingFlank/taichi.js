import * as ti from '../../../dist/taichi.dev.js'

let main = async () => {
    await ti.init()

    let hdrTexture = await ti.engine.HdrLoader.loadFromURL('../resources/footprint_court.hdr')

    let pixels = ti.Vector.field(4, ti.f32, hdrTexture.dimensions)

    ti.addToKernelScope({ pixels, hdrTexture })

    let kernel = ti.kernel(() => {
        for (let I of ndrange(hdrTexture.dimensions[0], hdrTexture.dimensions[1])) {
            pixels[I] = ti.textureLoad(hdrTexture, I)
        }
    })

    let htmlCanvas = document.getElementById('result_canvas')
    htmlCanvas.width = hdrTexture.dimensions[0]
    htmlCanvas.height = hdrTexture.dimensions[1]
    let canvas = new ti.Canvas(htmlCanvas)

    let i = 0
    async function frame() {
        if (window.shouldStop) {
            return
        }
        kernel()
        i = i + 1
        canvas.setImage(pixels)
        requestAnimationFrame(frame)
    }
    await frame()
}

main()
