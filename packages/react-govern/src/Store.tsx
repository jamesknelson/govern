import * as React from 'react'
import * as PropTypes from 'prop-types'
import { createElement, instantiate, Dispatcher, GovernElement, GovernNode, Store as GovernStore, Subscription } from 'govern'


export interface StoreProps<T> {
  of: GovernElement<T>,
  children: (store: GovernStore<T>) => React.ReactNode,
}


/**
 * A factory to create a `<Store to>` React element, with typing.
 * @param store The store to subscribe to
 * @param children A function to render each of the store's values.
 */
export function createStore<T>(
  of: GovernElement<T>,
  children: (store: GovernStore<T>) => React.ReactNode
): React.ReactElement<StoreProps<T>> {
  return React.createElement(Store, { of, children })
}


/**
 * Accepts an observable as a prop, and passes each of its values to the
 * component's children via a render function.
 * 
 * NOTE: this component should be generic on output type, but TSX doesn't
 * properly support generic components. In the meantime, if you want
 * typing, use the `createSubscribe` factory.
 * 
 * See https://github.com/Microsoft/TypeScript/issues/14729.
 */
export class Store extends React.Component<StoreProps<any>, { output: any, dummy: any, dispatch: any }> {
  static contextTypes = {
    govern_dispatcher: PropTypes.object,
  }

  static childContextTypes = {
    govern_dispatcher: PropTypes.object,
  }

  dispatcher: Dispatcher
  store: GovernStore<any>
  isDispatching: boolean
  
  constructor(props: StoreProps<any>, context: any) {
    super(props, context)

    this.dispatcher = context.govern_dispatcher || new Dispatcher()
    this.state = {} as any
    this.isDispatching = false
    this.store = instantiate(createElement(Flatten, { children: this.props.of }), this.dispatcher)
  }

  getChildContext() {
    return {
      govern_dispatcher: this.dispatcher,
    }
  }

  componentWillMount() {
    if (!this.props.of) {
      console.warn(`An "element" prop must be provided to <Store> but "${this.props.of}" was received.`)
    }
  }

  componentWillReceiveProps(nextProps: StoreProps<any>) {
    if (!nextProps.of) {
      console.warn(`A "element" prop must be provided to <StoreProps> but "${this.props.of}" was received.`)
    }

    // As elements are immutable, we can skip a lot of updates by
    // checking if the `to` element/store has changed.
    if (nextProps.of !== this.props.of) {
      this.store.setProps({
        children: nextProps.of,
      })
    }
  }

  componentDidCatch(error) {
    this.disposeStore()
  }

  componentWillUnmount() {
    this.disposeStore()
  }

  disposeStore() {
    if (this.store) {
      this.store.dispose()
      delete this.store
    }
  }

  render() {
    return this.props.children(this.store)
  }
}

/**
 * A Govern component that accepts an element or store, instantiates and
 * updates props if required, and returns the output.
 */
function Flatten(props: { children: GovernNode }) {
  return props.children
}
