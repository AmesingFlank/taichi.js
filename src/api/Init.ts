import { Program, ProgramOptions } from '../program/Program';

let initialized = false;

async function init(options?: ProgramOptions) {
    if (!initialized) {
        await Program.getCurrentProgram().init(options);
        initialized = true;
    }
    Program.getCurrentProgram().clearKernelScope();
}

export { init };
