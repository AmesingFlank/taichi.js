import { fractal, fractal3D, vortexRing,rasterizer,mpm99, cornellBox, rotatingCube } from "./presets.js";

const editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
    mode: "javascript",
    lineNumbers: true,
});
editor.setSize("100%","70%");

const logger = CodeMirror.fromTextArea(document.getElementById("logger"), {
    mode: "javascript",
});
logger.setSize("100%","18%");


const compileAndRunButton = document.getElementById("CompileRunButton")
const stopButton = document.getElementById("StopButton")

let cancelAllAnimationFrames = ()=>{
    var id = window.requestAnimationFrame(()=>{});
    while(id--){
      window.cancelAnimationFrame(id);
    }
}

let preprocessCode = (code) => {
    return `
    let userMain = async () => {
        ${code}
    }
    userMain().catch(
        (e) => {
            console.error(e)
        }
    )
    `
} 

let logs = ""
console.log = function(...args) {
    let s = ""
    for(let a of args){
        s += String(a) + " "
    }
    logs += "\n" + s
    if(logs.length > 10000){
        logs = logs.slice(-10000)
    }
    logger.setValue(logs)
    let lineCount = logger.lineCount()
    logger.setCursor(lineCount)
};
console.error = function(...args){
    console.log(...args)
}

let compileAndRun = ()=>{
    cancelAllAnimationFrames()
    logs = ""
    logger.setValue("")
    let code = editor.getValue();
    code = preprocessCode(code)
    try{
        eval(code)
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            console.error("Syntax Error in code editor: ",e)
        }
        else{
            console.error("Error in code editor: ",e)
        }
    }
}
 

compileAndRunButton.onclick = ()=>{
    compileAndRun()
}
stopButton.onclick = () => {
    cancelAllAnimationFrames()
}

let examples = [
    {listItem:"Fractal", code:fractal},
    {listItem:"Fractal3D", code:fractal3D},
    {listItem:"VortexRing", code:vortexRing},
    {listItem:"Rasterizer", code:rasterizer},
    {listItem:"Mpm99", code:mpm99},
    {listItem:"CornellBox", code:cornellBox},
    {listItem:"RotatingCube", code:rotatingCube},
]

let examplesMap = {}

for(let ex of examples){
    examplesMap[ex.listItem] = ex
    let item = document.getElementById(ex.listItem)
    item.onclick = ()=>{
        editor.setValue(ex.code)
        compileAndRun()
    }
}
 

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
if(urlParams.has("preset") && examplesMap[urlParams.get("preset")]){
    let preset = examplesMap[urlParams.get("preset")]
    editor.setValue(preset.code)
    compileAndRun()
}
else{
    editor.setValue(fractal)    
    compileAndRun()
}
 
