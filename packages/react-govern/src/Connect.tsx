import * as React from 'react'
import * as Govern from 'govern'
import { createSubscribe } from 'react-outlets'
import { Source } from './Source'

/**
 * A HoC to create and dispose a Govern Component of the given type with the
 * wrapped component.
 *
 * The props for the returned component are fed to the Govern Component, with
 * its output injected into the wrapped componend via `<Connect>`.
 */
export function connect(mapPropsToElement: (props) => Govern.GovernElement<any, any>, mergeProps?: (output, ownProps) => any);
export function connect(element: Govern.GovernElement<any, any>, mergeProps?: (output, ownProps) => any);
export function connect(component: Govern.ComponentClass<any, any>, mergeProps?: (output, ownProps) => any);
export function connect(
  mapPropsToElement:
    ((props) => Govern.GovernElement<any, any>) |
    Govern.GovernElement<any, any> |
    Govern.ComponentClass<any, any>,
  mergeProps = (output, ownProps) => Object.assign({}, ownProps, output)
) {
  let mapFn = mapPropsToElement as (props) => Govern.GovernElement<any, any>
  if (Govern.isValidElement(mapPropsToElement)) {
    mapFn = (() => mapPropsToElement) as any
  }
  else if (mapPropsToElement instanceof Govern.Component.constructor) {
    mapFn = (props) => Govern.createElement(mapPropsToElement as any, props)
  }

  if (typeof mapFn !== 'function') {
    throw new Error(`"govern(..., mapFn)" received an unknown "mapFn" of type "${typeof mapFn}" for "${String(mapPropsToElement)}".`)
  }

  return WrappedComponent => {
    return class Connect extends React.Component<any, any> {
      renderChild = (output) =>
        <WrappedComponent {...mergeProps(output, this.props)} />

      render() {
        return (
          <Source element={mapFn(this.props)}>
            {observable => createSubscribe(observable, this.renderChild)}
          </Source>
        )
      }
    }
  }
}


// deprecated name.
export const govern = connect;


export interface ConnectProps {
  to: Govern.GovernElement<any, any>,
  children: (value: any) => React.ReactNode,
}

export class Connect extends React.Component<ConnectProps, any> {
  render() {
    return (
      <Source element={this.props.to}>
        {observable => createSubscribe(observable, this.props.children)}
      </Source>
    )
  }
}