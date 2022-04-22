import * as ti from "../dist/taichi.dev.js"
console.log("running tests")
 

let main = async () => {
    await ti.runAllTests()
    console.log("Running examples")
    await import("../examples/fractal-cloth/index.js")
}
main() 