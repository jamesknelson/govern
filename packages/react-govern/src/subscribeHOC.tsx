import * as React from 'react'
import { createElement, isValidElement, isValidStore, Component, ComponentClass, GovernElement, Store } from 'govern'
import { createSubscribe } from './Subscribe'


// subscribe(
//   mapOwnPropsToElement,
//   mapValueToProps, // receives dispatch and ownProps too
//   mapDispatchToProps, // receives value and ownProps too
//   merge
// )

export function subscribe<T, WrapperProps=any, WrappedProps=any>(
  mapOwnPropsToElement: (props: any) => (GovernElement<any, T> | Store<T>),
  mapValueToProps?: (value: T, dispatch?: Function, ownProps?: WrapperProps) => any,
  mapDispatchToProps?: (dispatch: Function, initialValue?: T) => any,
  merge?: (valueProps?: any, dispatchProps?: any, ownProps?: WrapperProps) => WrappedProps
): (component: React.ComponentType<WrappedProps>) => React.ComponentClass<WrapperProps>;

export function subscribe<T, WrapperProps=any, WrappedProps=any>(
  element: GovernElement<any, T> | Store<T>,
  mapValueToProps?: (value: T, dispatch?: Function, ownProps?: WrapperProps) => any,
  mapDispatchToProps?: (dispatch: Function, initialValue?: T) => any,
  merge?: (valueProps?: any, dispatchProps?: any, ownProps?: WrapperProps) => WrappedProps
): (component: React.ComponentType<WrappedProps>) => React.ComponentClass<WrapperProps>;

export function subscribe<T, WrapperProps=any, WrappedProps=any>(
  component: ComponentClass<any, T>,
  mapValueToProps?: (value: T, dispatch?: Function, ownProps?: WrapperProps) => any,
  mapDispatchToProps?: (dispatch: Function, initialValue?: T) => any,
  merge?: (valueProps?: any, dispatchProps?: any, ownProps?: WrapperProps) => WrappedProps
): (component: React.ComponentType<WrappedProps>) => React.ComponentClass<WrapperProps>;

/**
 * A Higher Order Component version of the <Subscribe to /> component.
 */
export function subscribe(
  mapOwnPropsToElement:
    ((props) => Store<any> | GovernElement<any, any>) |
    GovernElement<any, any> |
    Store<any> |
    ComponentClass<any, any>,
  mapValueToProps = (value, dispatch?, ownProps?) => value,
  mapDispatchToProps = (dispatch, initialValue?) => ({ dispatch }),
  merge = (valueProps?, dispatchProps?, ownProps?) => Object.assign({}, valueProps, dispatchProps, ownProps),
): (component: React.ComponentType<any>) => React.ComponentClass<any> {
  let mapFn = mapOwnPropsToElement as (props) => (GovernElement<any, any> | Store<any>)
  
  if (isValidElement(mapOwnPropsToElement) || isValidStore(mapOwnPropsToElement)) {
    mapFn = (() => mapOwnPropsToElement) as any
  }
  else if (mapOwnPropsToElement instanceof Component.constructor) {
    mapFn = (props) => createElement(mapOwnPropsToElement as any, props)
  }

  if (typeof mapFn !== 'function') {
    throw new Error(`"govern(..., mapFn)" received an unknown "mapFn" of type "${typeof mapFn}" for "${String(mapOwnPropsToElement)}".`)
  }

  let decorator = (WrappedComponent: React.ComponentType<any>) =>
    // Use a class component instead of a stateless functional component so
    // that consumers can use refs if they need.
    class SubscribeWrapper extends React.Component<any> {
      dispatchProps: any

      render() {
        return createSubscribe(mapFn(this.props), (value, dispatch) => {
          let valueProps = mapValueToProps(value, dispatch, this.props)
          if (!this.dispatchProps) {
            this.dispatchProps = mapDispatchToProps(dispatch, value)
          }
          return React.createElement(WrappedComponent, merge(valueProps, this.dispatchProps, this.props))
        })
      }

      componentWillUnmount() {
        delete this.dispatchProps
      }
    }
  
  return decorator
}

  