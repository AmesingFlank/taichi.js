console.log("heyy")

import {ti} from "../dist/taichi.dev.js"

let main = async () => {
    await ti.runAllTests()
    await ti.taichiExample6Fractal(document.getElementById("fractal_canvas"))
    // await ti.taichiExample7VortexRing(document.getElementById("vortex_ring_canvas"))
    await ti.simpleGraphicsExample(document.getElementById("simple_graphics_example_canvas"))
    await ti.clothExample(document.getElementById("cloth_example_canvas"))
}
main()

