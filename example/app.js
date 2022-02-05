console.log("heyy")

let main = async () => {
    await ti.triangle(document.getElementById("triangle_canvas"))
    await ti.computeBoids(document.getElementById("computeBoids_canvas"))
    //await ti.taichiExample0()
    //await ti.taichiExample1()
    //await ti.taichiExample2VortexRing(document.getElementById("vortex_ring_canvas"))
    //await ti.taichiExample3VortexRingSpv(document.getElementById("vortex_ring_spv_canvas"))
    //await ti.taichiExample4()
    //await ti.taichiExample5()
    await ti.runAllTests()
}
main()

