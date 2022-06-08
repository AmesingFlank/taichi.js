import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 1280;
    htmlCanvas.height = 720;

    let scene = new ti.engine.Scene()
    //await scene.addGLTF("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SciFiHelmet/glTF/SciFiHelmet.gltf", new ti.engine.Transform(ti.translate([-2.0, 0.0, 0.0])))
    await scene.addGLTF("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb", new ti.engine.Transform(ti.translate([0.0, 0.0, 0.0])))
    //scene.ibl = await ti.engine.HdrLoader.loadFromURL("../rendering/resources/footprint_court.hdr")

    // scene.lights.push(new ti.engine.LightInfo(
    //     ti.engine.LightType.Point,
    //     1,
    //     [1, 1, 1],
    //     1000,
    //     [300, 300, 300],
    // ))
    scene.lights.push(new ti.engine.LightInfo(
        ti.engine.LightType.Spot,
        10,
        [1, 1, 1],
        1000,
        [-5, 5, -5],
        ti.normalized([1, -1, 1]),
        0,
        Math.PI/64,
    ))

    scene.lights.push(new ti.engine.LightInfo(
        ti.engine.LightType.Directional,
        1,
        [0.1, 0.5, 1],
        0,
        [0,0,0],
        ti.normalized([1, 1, 1]),
    ))

    console.log(scene)

    let renderer = new ti.engine.Renderer(scene, htmlCanvas)
    await renderer.init()
    let camera = new ti.engine.Camera([0.0, 0.0, 3.0], [0.0, 0.0, -1.0])

    let t = 0
    async function frame() {
        t = t + 1
        camera.position = [3 * Math.sin(t * 0.01), 0, 3 * Math.cos(t * 0.01)]
        camera.direction = ti.neg(ti.normalized(camera.position))
        renderer.render(camera);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

};

main()
