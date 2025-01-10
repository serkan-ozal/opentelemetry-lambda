const path = require('path');
const { NormalModuleReplacementPlugin } = require('webpack');

module.exports = {
  entry: './src/wrapper.ts',
  target: 'node',
  mode: 'production',
  externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
  externals: [
    '@aws-sdk', // in order to ignore "aws-sdk" packages
  ],
  output: {
    path: path.resolve('./build/src'),
    filename: 'wrapper.js',
    libraryTarget: "commonjs2",
  },
  resolve: {
    extensions: ['.ts', '.js', '.mjs'],
    modules: [
      path.resolve('./src'),
      'node_modules',
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ],
  },
  plugins: [
    new NormalModuleReplacementPlugin(
      /^semver$/,
      `${__dirname}/src/patched-semver.js`
    )
  ],
  optimization: {
    minimize: true,
    providedExports: true,
    usedExports: true
  },
};
