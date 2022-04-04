// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/taichi.ts',
  output: {
    dir: 'lib',
    format: 'es'
  },
  plugins: [
    typescript(),
    commonjs(),
    resolve({
      browser: true
    }),
  ]
};