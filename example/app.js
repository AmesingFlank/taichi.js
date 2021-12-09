let ti = taichi

function f(){
    return 3;
}
ti.kernel(f)

console.log("heyy")

let main = async () => {
    await ti.triangle(document.getElementById("triangle_canvas"))
    await ti.computeBoids(document.getElementById("computeBoids_canvas"))
    await ti.taichiExample0()
    await ti.taichiExample1()
}
main()

