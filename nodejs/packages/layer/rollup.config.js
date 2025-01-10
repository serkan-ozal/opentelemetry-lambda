const resolve = require('@rollup/plugin-node-resolve');
const typescript = require('@rollup/plugin-typescript');
const json = require('@rollup/plugin-json');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');

module.exports = [
  {
    input: './src/wrapper.ts',
    external: [
      'aws-sdk', 'util', 'url',
      'os', 'child_process', 'fs', 'net',
      'http', 'https', 'zlib', 'path',
    ],
    output: {
      file: 'build/src/wrapper.js',
      format: 'cjs',
    },
    plugins: [
      resolve(),
      commonjs({transformMixedEsModules: true}),
      typescript({
        exclude: ["test/**"]
      }),
      json(),
      terser()
    ],
    treeshake: {
      preset: 'smallest',
    }
  },
]
