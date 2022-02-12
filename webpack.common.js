//webpack.config.js
const path = require('path');

module.exports = {
  mode: "production",
  entry: {
    main: "./src/taichi.ts",
  },
  output: {
    path: path.resolve(__dirname, './lib'),
    filename: "ti.js" // <--- Will be compiled to this single file
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    fallback: {
      "fs": false,
      "tls": false,
      "net": false,
      "path": false,
      "zlib": false,
      "http": false,
      "https": false,
      "stream": false,
      "crypto": false,
    } 
  },
  module: {
    rules: [
      { 
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  }
};