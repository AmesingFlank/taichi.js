import * as ts from "typescript";
import {CompilerContext} from '../../frontend/Compiler'
 
export function typecheckerExample0 () {
  let code = `
  function k(){
    for(let i of range(10)){
      f[i] = i
    }
  }
  `
  let compilerContext = new CompilerContext()


  let program = compilerContext.createProgramFromSource(code,{})

  // Get the checker, we will use it to find more about classes
  let checker = program.getTypeChecker();

  console.log(program,checker)

} 