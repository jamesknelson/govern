import * as React from 'react'
import { createElement, isValidElement, isValidObservable, Component, ComponentClass, GovernObservable, GovernElement } from 'govern'
import { Store } from './Store'

// Diff / Omit taken from https://github.com/Microsoft/TypeScript/issues/12215#issuecomment-311923766
type Diff<T extends string | number | symbol, U extends string | number | symbol> = ({ [P in T]: P } & { [P in U]: never } & { [x: string]: never })[T]
type Omit<U, K extends keyof U> = Pick<U, Diff<keyof U, K>>

// Injects props and removes them from the prop requirements.
// Will not pass through the injected props if they are passed in during
// render. Also adds new prop requirements from TNeedsProps.
// Taken from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react-redux/index.d.ts
interface InferableComponentEnhancerWithProps<TInjectedProps, TNeedsProps> {
    <P extends TInjectedProps>(
        component: React.ComponentType<P>
    ): React.ComponentClass<Omit<P, keyof TInjectedProps> & TNeedsProps>
}

// Injects props and removes them from the prop requirements.
// Will not pass through the injected props if they are passed in during
// render.
// Taken from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react-redux/index.d.ts
type InferableComponentEnhancer<TInjectedProps> =
    InferableComponentEnhancerWithProps<TInjectedProps, {}>

// withStore(
//   mapOwnPropsToElement,
//   propName='store'
// )

interface WithStore {
    <TPropName extends string = 'store', TOwnProps = {}, Value = {}>(
        mapOwnPropsToElement: MapOwnPropsToPropsParam<TOwnProps, Value>,
        propName?: TPropName
    ): InferableComponentEnhancerWithProps<StoreProp<Value, TPropName>, TOwnProps>;

    <TPropName extends string = 'store', Value = {}>(
        element: GovernElement<Value>,
        propName?: TPropName
    ): InferableComponentEnhancer<StoreProp<Value, TPropName>>;

    <TPropName extends string = 'store', Value = {}, TComponentProps = {}>(
        componentClass: ComponentClass<Value, TComponentProps>,
        propName?: TPropName
    ): InferableComponentEnhancerWithProps<StoreProp<Value, TPropName>, TComponentProps>;
}

type MapOwnPropsToPropsParam<TOwnProps, Value> = (props: TOwnProps) => GovernElement<Value>

type StoreProp<Value, PropName extends string> = {
    [K in PropName]: GovernObservable<Value>
}

/**
 * A Higher Order Component version of the <Store of /> component.
 */
export const withStore: WithStore = (
  mapOwnPropsToElement:
    ((props) => GovernElement<any>) |
    GovernElement<any> |
    ComponentClass<any, any>,
  propName: string = 'store',
) => {
  let mapFn = mapOwnPropsToElement as (props) => (GovernElement<any>)
  
  if (isValidElement(mapOwnPropsToElement)) {
    mapFn = (() => mapOwnPropsToElement) as any
  }
  else if (mapOwnPropsToElement instanceof Component.constructor) {
    mapFn = (props) => createElement(mapOwnPropsToElement as any, props)
  }

  if (typeof mapFn !== 'function') {
    throw new Error(`"govern(..., mapFn)" received an unknown "mapFn" of type "${typeof mapFn}" for "${String(mapOwnPropsToElement)}".`)
  }

  let decorator = (WrappedComponent: React.ComponentType<any>): React.ComponentClass<any> =>
    // Use a class component instead of a stateless functional component so
    // that consumers can use refs if they need.
    class SubscribeWrapper extends React.Component<any> {
      render() {
        return Store.Element({
          element: mapFn(this.props),
          children: (store) => {
            return React.createElement(WrappedComponent, {
              ...this.props,
              [propName]: store
            })
          }
        })
      }
    }
  
  return decorator
}

  