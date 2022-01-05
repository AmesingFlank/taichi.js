const fs = require('fs') 

const wasmCode = fs.readFileSync("scripts/tint.wasm");
const encoded = Buffer.from(wasmCode, 'binary').toString('base64')
// console.log(encoded)

let sourceCode = `
export const tintWasmBase64 = \`${encoded}\`
`

fs.writeFile("src/tint/tintWasmBase64.ts", sourceCode, err => {
  if (err) {
    console.error(err)
    return
  }
  //file written successfully
})