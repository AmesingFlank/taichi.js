import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 1280;
    htmlCanvas.height = 720;

    let scene = await ti.utils.GltfLoader.loadFromURL("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb")
    scene.ibl = await ti.utils.HdrLoader.loadFromURL("../rendering/resources/footprint_court.hdr")

    // scene.lights.push(new ti.utils.LightInfo(
    //     ti.utils.LightType.Point,
    //     [300, 300, 300],
    //     1000000,
    //     [1, 1, 1],
    //     1000
    // ))
    // scene.lights.push(new ti.utils.LightInfo(
    //     ti.utils.LightType.Point,
    //     [-300, -300, -300],
    //     1000000,
    //     [1, 1, 1],
    //     1000
    // ))

    console.log(scene)

    let renderer = new ti.utils.Renderer(scene, htmlCanvas)
    await renderer.init()
    let camera = new ti.utils.Camera([0.0, 0.0, 3.0], [0.0, 0.0, -1.0])
 
    let t = 0
    async function frame() {
        t = t + 1
        camera.position = [3*Math.sin(t * 0.01), 0, 3*Math.cos(t*0.01)]
        camera.direction = ti.neg(ti.normalized(camera.position))
        renderer.render(camera);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

};

main()
