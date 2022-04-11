// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/taichi.ts',
  output: [
    {
      file: "dist/taichi.dev.js",
      format: 'es',
    },
    {
      file: "dist/taichi.dev.umd.js",
      name: "ti",
      format: 'umd',
    }
  ],
  plugins: [
    typescript(),
    commonjs(),
    resolve({
      browser: true
    }),
  ]
};