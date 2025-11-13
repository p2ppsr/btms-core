// frontend/webpack.dev.js
const path = require('path')
const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')

module.exports = merge(common, {
  mode: 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    // match prod's fallbacks so @bsv/sdk stops yelling
    fallback: {
      crypto: require.resolve('crypto-browserify'),
      https: require.resolve('https-browserify'),
      http: require.resolve('stream-http'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer/'),
      vm: require.resolve('vm-browserify')
    }
  },
  devServer: {
    open: true,
    port: 8093,
    hot: true,
    liveReload: false,
    client: {
      overlay: false   // 👈 don't block the UI with warnings
    },
    historyApiFallback: {
      index: 'index.html'
    },
    static: {
      directory: path.resolve(__dirname, 'public')
    }
  },
  devtool: 'inline-source-map'
})
