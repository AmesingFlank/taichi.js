let ti = taichi

function f(){
    return 3;
}
ti.kernel(f)

console.log("heyy")

ti.triangle(document.getElementById("triangle_canvas"))
ti.computeBoids(document.getElementById("computeBoids_canvas"))
ti.runTaichiProgram()