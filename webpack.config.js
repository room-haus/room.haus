const {EnvironmentPlugin} = require('webpack');
const path = require('node:path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const entrancePages = require('./src/content/entrance.json');
const sections = [{path: '/mixes/', title: 'S/S 2017-2019'}, ...entrancePages.slice(1)];
const src = path.join(__dirname, 'src');
const modelRoot = path.join(src, 'babylon/models');

module.exports = (_env, argv) => ({
  entry: {main: './src/index.js', entrance: ['./src/styles/layout.css', './src/styles/entrance.css']},
  target: 'web',
  devtool: argv.mode === 'development' ? 'cheap-module-source-map' : false,
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '/',
    filename: 'assets/[name].[contenthash:12].js',
    chunkFilename: 'assets/[name].[contenthash:12].js',
    assetModuleFilename: 'assets/[name].[contenthash:12][ext]',
    clean: true,
  },
  devServer: {
    host: '127.0.0.1',
    historyApiFallback: {
      rewrites: [
        ...entrancePages.map(({path}) => ({from: new RegExp('^' + path.slice(0, -1) + '/?$'), to: path + 'index.html'})),
        {from: /^\/[^.]*$/, to: '/mixes/index.html'},
      ],
    },
    static: false,
    client: {overlay: {errors: true, warnings: false}},
  },
  resolve: {alias: {src}},
  module: {
    rules: [
      {test: /\.js$/, include: src, exclude: /worklets/, loader: 'babel-loader', options: {envName: argv.mode}},
      {test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader']},
      {
        include: path.join(modelRoot, 'MX018/jett.babylon'),
        test: /\.babylon$/,
        use: path.join(__dirname, 'scripts/index-mx018-model.cjs'),
      },
      {
        test: /\.(babylon|manifest|dds|env|3dl|png|jpe?g|svg|ttf|otf|woff2?|mp3)$/i,
        type: 'asset/resource',
        oneOf: [
          {
            // Babylon resolves a model's manifest and companion textures relative to the model.
            include: modelRoot,
            generator: {
              filename: ({filename}) => 'models/' + filename.split('babylon/models/')[1],
            },
          },
          {
            // CubeTexture appends face suffixes to the shared URL prefix.
            include: path.join(src, 'babylon/skyboxes'),
            generator: {
              filename: ({filename}) => 'models/skyboxes/' + filename.split('/').slice(-2).join('/'),
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new EnvironmentPlugin({ROOM_MEDIA_ORIGIN: '', ROOM_MX029_AUDIO_URL: ''}),
    new MiniCssExtractPlugin({filename: 'assets/[name].[contenthash:12].css'}),
    new CopyPlugin({patterns: [
      ...['instrumentserif', 'googlesanscode'].map((family) => ({
        from: path.join(src, 'styles/fonts', family, 'OFL.txt'),
        to: 'assets/' + family + '-license.[contenthash:12].txt',
      })),
      {from: path.join(src, 'audio/worklets/OnsetWorkletProcessor'), to: 'worklets', info: {minimized: true}},
      {from: path.join(modelRoot, 'CD/*.{jpg,png}'), to: 'models/CD/[name][ext]'},
      {from: path.join(src, 'babylon/textures/environment.dds'), to: 'models/CD/environment.dds'},
      {from: path.join(modelRoot, 'MX018/environment.dds'), to: 'models/MX018/environment.dds'},
    ]}),
    new HtmlWebpackPlugin({
      filename: 'mixes/index.html',
      chunks: ['main'],
      template: './src/entrance.html',
      page: null,
      sections,
      favicon: './src/favicon.png',
    }),
    ...entrancePages.map((page) => new HtmlWebpackPlugin({
      filename: page.path.slice(1) + 'index.html',
      chunks: [page.path === '/' ? 'main' : 'entrance'],
      template: './src/entrance.html',
      favicon: './src/favicon.png',
      page,
      sections,
    })),
  ],
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        babylon: {test: /[\\/]node_modules[\\/]babylonjs[\\/]/, name: 'babylon', priority: 20},
        hls: {test: /[\\/]node_modules[\\/]hls\.js[\\/]/, name: 'hls', priority: 20},
      },
    },
  },
  // Apply entry-point budgets to scripts and styles, independently of on-demand scene models.
  performance: {
    hints: argv.mode === 'production' ? 'warning' : false,
    assetFilter: name => /\.(js|css)$/.test(name) && !name.startsWith('worklets/'),
    maxAssetSize: 6 * 1024 * 1024,
    maxEntrypointSize: 400 * 1024,
  },
  stats: 'errors-warnings',
});
