import React from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'
import ControllerFactory from './ControllerFactory'
import Subscribe from './Subscribe'


// Use a full component instead of a stateless function component so that
// the user can add a ref to it if they need to do so.
export class ControlledBy extends React.Component {
  render() {
    const { component, props, render } = this.props
    return (
      <ControllerFactory
        component={component}
        props={props}
        render={({ controller }) =>
          <Subscribe to={controller} render={render} />
        }
      />
    )
  }
}

/**
 * A HoC to create and destroy a Govern Component of the given type with the
 * wrapped component.
 *
 * The props for the returned component are fed to the Govern Component, with
 * its output injected into the wrapped componend via `<Subscribe>`.
 */
export function controlledBy(governComponent) {
  return WrappedComponent => {
    const ControlledByRenderer = ({ controller }) =>
      <Subscribe to={controller} render={WrappedComponent} />

    // Use a full component instead of a stateless function component so that
    // the user can add a ref to it if they need to do so.
    class ControlledBy extends React.Component {
      render() {
        return (
          <ControllerFactory
            component={governComponent}
            props={this.props}
            render={ControlledByRenderer}
          />
        )
      }
    }

    hoistNonReactStatics(ControlledBy, WrappedComponent)

    return ControlledBy
  }
}
