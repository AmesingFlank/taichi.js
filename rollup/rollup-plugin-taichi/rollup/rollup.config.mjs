// rollup.config.js
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs'; 
export default {
  input: 'src/index.ts',
  output: [
    {
      file: "dist/rollup-plugin-taichi.js",
      format: 'es',
    },
    {
      file: "dist/rollup-plugin-taichi.umd.js",
      name: "rollup-plugin-taichi",
      format: 'umd',
    }
  ],
  plugins: [
    commonjs(),
    resolve(), 
    typescript(),
  ],
  watch: {
    chokidar: {
        paths: 'src/**',
        usePolling: true
    }
  }
};