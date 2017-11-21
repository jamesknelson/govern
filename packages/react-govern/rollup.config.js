/**
 * This is based on the rollup config from Redux
 * Copyright (c) 2015-present Dan Abramov
 */

import nodeResolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import { list as babelHelpersList } from 'babel-helpers'
import replace from 'rollup-plugin-replace'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'

const env = process.env.NODE_ENV

const config = {
  name: 'ReactGovern',
  input: 'src/index.js',
  output: {
    format: 'umd',
  },
  external: [
    'react',
    'govern'
  ],
  globals: {
    'react': 'React',
    'govern': 'Govern'
  },
  plugins: [
    nodeResolve(),
    babel({
      exclude: '**/node_modules/**',
      plugins: ['external-helpers'],
      externalHelpersWhitelist: babelHelpersList.filter(helperName => helperName !== 'asyncGenerator')
    }),
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