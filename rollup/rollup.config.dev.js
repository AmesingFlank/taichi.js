// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import taichi from "./rollup-plugin-taichi/dist/rollup-plugin-taichi.js"

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
    taichi({
      exclude: (f) => {
        if (endWith(f,".js")){
          return true
        }
        return false
      }
    }),
    commonjs(),
    resolve({
      browser: true
    }),
    replace({
      'require("source-map-support").install()': '',
      delimiters: ['', '']
    }),
    typescript(),
  ],
  watch: {
    chokidar: {
      paths: 'src/**',
      usePolling: true
    }
  }
};

function endWith(str, substr) {
  return str.slice(-substr.length) === substr
}