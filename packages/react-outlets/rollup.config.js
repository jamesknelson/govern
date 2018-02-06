/**
 * This is based on the rollup config from Redux
 * Copyright (c) 2015-present Dan Abramov
 */

import nodeResolve from 'rollup-plugin-node-resolve'
import replace from 'rollup-plugin-replace'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'

const env = process.env.NODE_ENV

const config = {
  name: 'ReactOutlets',
  input: 'dist/umd-intermediate/index.js',
  output: {
    format: 'umd',
  },
  external: [
    'react',
    'outlets',
  ],
  globals: {
    'react': 'React',
    'outlets': 'Outlets'
  },
  plugins: [
    nodeResolve(),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env)
    }),
    commonjs()
  ]
}

if (env === 'production') {
  config.plugins.push(
    uglify({
      compress: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false
      }
    })
  )
}

export default config