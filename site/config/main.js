/**
 * This file is used to tell Sitepack how to load your app once the page's
 * JavaScript has been loaded.
 *
 * Sitepack will call the default export, passing in an object with `history`
 * and `site` keys. These two arguments are also passed to the function
 * exported by `renderToString.js`, allowing re-use of the `Application`
 * component between both files.
 *
 * - `history` is a History object, produced by the history package. It
 *   contains the URL for your application, and can be used with routers
 *   like react-router and junctions.
 *   
 *   See https://github.com/mjackson/history for more details.
 *
 * - `site` contains a Site object. This object has two properties:
 * 
 *   + `rootPage` points to the root Page for your site
 *   + `pages` contains an object with all pages in your site, keyed by
 *     page ID.
 *
 * The `main` function also receives a string specifying the current
 * environment, which will either be "production" or "development".
 */

import React from 'react'
import ReactDOM from 'react-dom'
import ExecutionEnvironment from 'exenv'
import Application from './Application'


if (typeof window !== "undefined") {
  // For some reason, `process` was throwing an error as not existing. However,
  // Webpack still replaces `process.env.NODE_ENV` with an appropriate string,
  // so we can create a fake process object.
  window.process = {
    env: {
      NODE_ENV: process.env.NODE_ENV
    }
  }
}


export default function main({ environment, history, site }) {
  const renderer = ExecutionEnvironment.canUseDOM ? ReactDOM.hydrate : ReactDOM.render

  renderer(
    React.createElement(Application, {
      environment: environment,
      history: history,
      site: site,
    }),
    document.getElementById('app')
  )
}
