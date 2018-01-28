import * as React from 'react'
import * as Govern from 'govern'
import { Source } from './Source'
import { Connect } from './Connect'

/**
 * A HoC to create and destroy a Govern Component of the given type with the
 * wrapped component.
 *
 * The props for the returned component are fed to the Govern Component, with
 * its output injected into the wrapped componend via `<Connect>`.
 */
export function govern(
  mapPropsToElement: (props) => Govern.GovernElement<any, any>,
  mergeProps = (output, ownProps) => Object.assign({}, ownProps, output)
) {
  return WrappedComponent => {
    return class Govern extends React.Component<any, any> {
      renderChild = (output) =>
        <WrappedComponent {...mergeProps(output, this.props)} />

      render() {
        return (
          <Source element={mapPropsToElement(this.props)}>
            {observable => <Connect to={observable} children={this.renderChild} />}
          </Source>
        )
      }
    }
  }
}
