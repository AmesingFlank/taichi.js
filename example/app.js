let ti = taichi

function f(){
    return 3;
}
ti.kernel(f)

console.log("heyy")

ti.triangle(document.getElementById("myCanvas"))