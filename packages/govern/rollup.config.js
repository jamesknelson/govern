/**
 * This is based on the rollup config from Redux
 * Copyright (c) 2015-present Dan Abramov
 */

import replace from 'rollup-plugin-replace'
import uglify from 'rollup-plugin-uglify'

const env = process.env.BUILD_ENV

const config = {
  input: 'dist/raw/index.js',
  name: 'Govern',
  plugins: []
}

if (env === 'umd-min') {
  config.output = { format: 'umd' }
  config.plugins.push(
    replace({
      '__DEV__': "false",
      'process.env.NODE_ENV': JSON.stringify("production")
    }),
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
else if (env === 'umd') {
  config.output = { format: 'umd' }
  config.plugins.push(
    replace({
      '__DEV__': "true",
      'process.env.NODE_ENV': JSON.stringify("development")
    }),
  )
}
else if (env === 'cjs') {
  config.output = { format: 'cjs' }
  config.plugins.push(
    replace({
      '__DEV__': 'process.env.NODE_ENV !== "production"',
    }),
  )
}
else if (env === 'es') {
  config.output = { format: 'es' }
  config.plugins.push(
    replace({
      '__DEV__': 'process.env.NODE_ENV !== "production"',
    }),
  )
}
else {
  console.error(`Unknown BUILD_ENV "${env}".`)
  process.exit(1)
}

export default config