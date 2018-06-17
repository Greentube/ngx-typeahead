const helpers = require('./config/helpers');
const webpack = require('webpack');
const CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = {
  devtool: '#source-map',

  resolve: {
    extensions: ['.ts', '.js']
  },

  entry: helpers.root('index.ts'),

  output: {
    path: helpers.root('bundles'),
    publicPath: '/',
    filename: 'ngx-type-ahead.umd.js',
    libraryTarget: 'umd',
    library: 'ngx-type-ahead'
  },

  // require those dependencies but don't bundle them
  externals: [/^@angular\//, /^rxjs\//],
  target: 'node',

  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.ts$/,
        loader: 'tslint-loader',
        exclude: [helpers.root('node_modules')]
      },
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader',
        options: {
          declaration: false
        },
        exclude: [/\.spec\.ts$/, helpers.root('node_modules')]
      }]
  },

  plugins: [
    new webpack.ContextReplacementPlugin(
      /@angular(\\|\/)core(\\|\/)esm5/,
      helpers.root('./src')
    ),

    new webpack.LoaderOptionsPlugin({
      options: {
        tslintLoader: {
          emitErrors: true,
          failOnHint: true
        }
      }
    }),
    new CleanWebpackPlugin(['bundles'], {
      root: helpers.root(),
      verbose: false,
      dry: false
    })
  ]
};
