const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
  const isDev = Boolean(env && env.development);
  return {
    entry: ['./src/index.js'],
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      libraryTarget: 'umd',
      publicPath: '/',
    },
    target: 'web',
    mode: isDev ? 'development' : 'production',
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
          exclude: [/node_modules/, /worklets/],
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
            outputPath: '/fonts/',
            publicPath: '/fonts/',
          },
        },
        {
          test: /\/skyboxes\/.+\.jpg$/,
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath(url, resourcePath) {
              const parts = resourcePath.split('/');
              const name = parts[parts.length - 2];
              return `/models/skyboxes/${name}/${url}`;
            },
          },
        },
        {
          test: /\.(babylon|dds|manifest|env|3dl)$/,
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            publicPath: '/',
          },
        },
        {
          test: /\.(png|jpeg|jpg|svg)$/,
          exclude: /skyboxes/,
          use: [
            'file-loader',
            {
              loader: 'image-webpack-loader',
              options: {
                disable: isDev,
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new CopyPlugin([{from: path.resolve(__dirname, './src/audio/worklets/**/*'), to: 'worklets/', flatten: true}]),
      new HtmlWebpackPlugin({
        favicon: path.resolve(__dirname, './src/favicon.png'),
        template: path.resolve(__dirname, './src/index.html'),
      }),
    ],
  };
};
