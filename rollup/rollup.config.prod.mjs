// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/taichi.ts',
  output: [
    {
      file: "dist/taichi.js",
      format: 'es',
    },
    {
      file: "dist/taichi.umd.js",
      name: "taichi",
      format: 'umd',
    }
  ],
  plugins: [
    typescript(),
    commonjs(),
    resolve({
      browser: true
    }),
    terser()
  ]
};