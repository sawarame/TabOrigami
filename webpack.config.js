const path = require('path');
const { VueLoaderPlugin } = require('vue-loader');

module.exports = {
  mode: 'production',
  entry: {
    popup: './src/popup/main.ts',
    background: './src/background/background.ts',
    options: './src/options/main.ts'
  },
  output: {
    path: path.resolve(__dirname, 'TabOrigami/js'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          appendTsSuffixTo: [/\.vue$/],
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.vue']
  },
  plugins: [
    new VueLoaderPlugin()
  ],
  devtool: 'source-map'
};
