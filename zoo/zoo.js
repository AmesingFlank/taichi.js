import { fractal, vortex_ring } from "./presets.js";

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
    userMain()
    `
} 

let compileAndRun = ()=>{
    cancelAllAnimationFrames()
    let code = editor.getValue();
    code = preprocessCode(code)
    eval(code)
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

compileAndRunButton.onclick = ()=>{
    compileAndRun()
}

let fractalListItem = document.getElementById("fractalHref")
fractalListItem.onclick = ()=>{
    editor.setValue(fractal)    
    compileAndRun()
}

let vortexRingListItem = document.getElementById("vortexRingHref")
vortexRingListItem.onclick = ()=>{
    editor.setValue(vortex_ring)    
    compileAndRun()
}
 
editor.setValue(fractal)    
compileAndRun()