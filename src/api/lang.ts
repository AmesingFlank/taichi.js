import {Program} from '../program/Program'


function globalScope(){
    return Program.getCurrentProgram().globalScopeProxy
}

export {globalScope}