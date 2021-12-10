let ti = taichi

function f(){
    return 3;
}
ti.kernel(f)

console.log("heyy")

let main = async () => {
    await ti.taichiExample2VortexRing(document.getElementById("vortex_ring_canvas"))
}
main()

