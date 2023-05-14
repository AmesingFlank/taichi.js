import * as ti from '../../../dist/taichi.dev.js';

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 1280;
    htmlCanvas.height = 720;

    let scene = new ti.engine.Scene();
    //await scene.addGLTF("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb", new ti.engine.Transform(ti.scale([0.1, 0.1, 0.1])))
    await scene.addGLTF('assets/bedroom/scene.gltf', new ti.engine.Transform(ti.translate([0.0, 0.0, 0.0])));
    //await scene.addGLTF("assets/venice/scene.gltf", new ti.engine.Transform(ti.translate([0.0, 0.0, 0.0])))
    scene.ibl = await ti.engine.HdrLoader.loadFromURL('../rendering/resources/footprint_court.hdr');
    scene.iblShadows.push(
        ti.engine.ShadowInfo.createIblShadowInfo(
            [30, 30, 30],
            ti.normalized([-1, -1, -1]),
            [50, 50],
            70,
            [1024, 1024],
            0.3
        )
    );

    // scene.lights.push(new ti.engine.DirectionalLightInfo(
    //     1,
    //     [0.1, 0.5, 1],
    //     ti.normalized([-1, -1, -1]),
    //     true,
    //     [30, 30, 30],
    //     new ti.engine.ShadowInfo([50, 50], 70)
    // ))

    let renderer = new ti.engine.Renderer(scene, htmlCanvas);
    await renderer.init();
    console.log(renderer);
    let camera = new ti.engine.Camera([20.0, 20.0, 20.0], ti.normalized([-1.0, -1.0, -1.0]));
    camera.track(htmlCanvas);
    let canvas = new ti.Canvas(htmlCanvas);

    let t = 0;
    async function frame() {
        t = t + 1;
        //camera.position = [30 * Math.sin(t * 0.01), 30, 30 * Math.cos(t * 0.01)]
        //camera.direction = ti.neg(ti.normalized(camera.position))
        renderer.render(camera);
        //canvas.setImage(renderer.shadowMaps[0])
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
};

main();
