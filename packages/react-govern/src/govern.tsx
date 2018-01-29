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
export function govern(mapPropsToElement: (props) => Govern.GovernElement<any, any>, mergeProps?: (output, ownProps) => any);
export function govern(element: Govern.GovernElement<any, any>, mergeProps?: (output, ownProps) => any);
export function govern(component: Govern.ComponentClass<any, any>, mergeProps?: (output, ownProps) => any);
export function govern(
  mapPropsToElement:
    ((props) => Govern.GovernElement<any, any>) |
    Govern.GovernElement<any, any> |
    Govern.ComponentClass<any, any>,
  mergeProps = (output, ownProps) => Object.assign({}, ownProps, output)
) {
  let mapFn = mapPropsToElement as (props) => Govern.GovernElement<any, any>
  if (mapPropsToElement instanceof Govern.GovernElement) {
    mapFn = () => mapPropsToElement
  }
  else if (mapPropsToElement instanceof Govern.Component.constructor) {
    mapFn = (props) => Govern.createElement(mapPropsToElement as any, props)
  }

  return WrappedComponent => {
    return class Govern extends React.Component<any, any> {
      renderChild = (output) =>
        <WrappedComponent {...mergeProps(output, this.props)} />

      render() {
        return (
          <Source element={mapFn(this.props)}>
            {observable => <Connect to={observable} children={this.renderChild} />}
          </Source>
        )
      }
    }
  }
}
