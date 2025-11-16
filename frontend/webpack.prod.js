// frontend/webpack.prod.js
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");

module.exports = merge(common, {
  mode: "production",
  module: {
    rules: [
      // let prod handle .ts / .tsx too
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      // allow imports like "react-toastify/dist/ReactToastify.css"
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    // so imports without extension work in prod too
    extensions: [".tsx", ".ts", ".js", ".jsx"],
    // fix webpack 5 “crypto/https” warnings from @bsv/sdk
    fallback: {
      crypto: require.resolve("crypto-browserify"),
      https: require.resolve("https-browserify"),
      http: require.resolve("stream-http"),
      stream: require.resolve("stream-browserify"),
      buffer: require.resolve("buffer/"),
      vm: require.resolve("vm-browserify"),
    },
  },
});
