import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Link, PageContentLoader } from 'sitepack-react'


export default class ArticleWrapper extends Component {
  static propTypes = {
    env: PropTypes.object.isRequired,
    page: PropTypes.object.isRequired,
  }

  factories = {
    a: (props, ...children) => React.createElement(Link, { ...props, env: this.props.env }, ...children)
  }

  renderPageContent = ({ env, page, errorMessage, isLoading, content }) => {
    if (content) {
      return React.createElement(content, { env, factories: this.factories })
    }
    else {
      return <div>Loading...</div>
    }
  }


  render() {
    const { site, series, page, hash } = this.props

    /**
     * A Sitepack Page will not always have its content available immediately.
     *
     * In order to reduce the bundle size of your application, Sitepack will
     * sometimes replace the `content` property of a Page object with a
     * function that returns a Promise to your content.
     *
     * While it is possible to handle these promises yourself, the
     * <PageContentLoader /> element from the `sitepack-react` package is the
     * recommended way of accessing your Page content in a React app.
     */
    return (
      <PageContentLoader
        page={page}
        render={this.renderPageContent}
        style={{height: '100%'}}
      />
    )
  }
}
