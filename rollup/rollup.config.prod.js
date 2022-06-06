// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import replace from '@rollup/plugin-replace';
import taichi from "./rollup-plugin-taichi/dist/rollup-plugin-taichi.js"

export default {
  input: 'src/taichi.ts',
  output: [
    {
      file: "dist/taichi.js",
      format: 'es',
    },
    {
      file: "dist/taichi.umd.js",
      name: "ti",
      format: 'umd',
    }
  ],
  plugins: [
    taichi({
      exclude: (f) => {
        if (endWith(f, ".js")) {
          return true
        }
        return false
      }
    }),
    commonjs(),
    resolve({
      browser: true
    }),
    terser(),
    replace({
      'require("source-map-support").install()': '',
      delimiters: ['', '']
    }),
    typescript(),
  ]
};
function endWith(str, substr) {
  return str.slice(-substr.length) === substr
}