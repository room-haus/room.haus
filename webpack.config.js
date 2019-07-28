const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: ['./src/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'umd',
    publicPath: '/',
  },
  target: 'web',
  mode: 'development',
  devServer: {
    contentBase: './dist',
    historyApiFallback: true,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src/'),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\/fonts\/.+\.(ttf|woff|woff2|eot|svg|otf)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          publicPath: '/',
        },
      },
      {
        test: /\.(babylon|png|jpeg|jpg|svg|dds)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          publicPath: '/',
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      favicon: path.resolve(__dirname, './src/favicon.png'),
      template: path.resolve(__dirname, './src/index.html'),
    }),
  ],
};