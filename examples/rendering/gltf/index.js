import * as ti from "../../../dist/taichi.dev.js"

let main = async () => {
    await ti.init();

    let htmlCanvas = document.getElementById('result_canvas');
    htmlCanvas.width = 720;
    htmlCanvas.height = 360; 
    
    let aspectRatio = htmlCanvas.width / htmlCanvas.height;

    let target = ti.canvasTexture(htmlCanvas);
    let depth = ti.depthTexture([htmlCanvas.width, htmlCanvas.height]);

    let scene = await ti.utils.GltfLoader.loadFromURL("../resources/WaterBottle.glb")
     
 
};

main()