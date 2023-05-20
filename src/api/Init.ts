import { Program, ProgramOptions } from '../program/Program';

let initialized = false;

async function init(options?: ProgramOptions) {
    await Program.getCurrentProgram().init(options);
}

export { init };
