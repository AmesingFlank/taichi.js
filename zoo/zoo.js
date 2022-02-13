import { fractal, fractal3D, vortex_ring,rasterizer } from "./presets.js";

const editor = CodeMirror.fromTextArea(document.getElementById("editor"), {
    mode: "javascript",
    lineNumbers: true,
});
editor.setSize("100%","70%");

const logger = CodeMirror.fromTextArea(document.getElementById("logger"), {
    mode: "javascript",
});
logger.setSize("100%","18%");


const compileAndRunButton = document.getElementById("btn")

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

let examples = [
    {listItem:"fractalHref", code:fractal},
    {listItem:"fractal3DHref", code:fractal3D},
    {listItem:"vortexRingHref", code:vortex_ring},
    {listItem:"rasterizerHref", code:rasterizer},
]

for(let ex of examples){
    let item = document.getElementById(ex.listItem)
    item.onclick = ()=>{
        editor.setValue(ex.code)
        compileAndRun()
    }
}
 
 
editor.setValue(fractal)    
compileAndRun()