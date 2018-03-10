import * as React from 'react'
import * as PropTypes from 'prop-types'
import { createElement, instantiate, GovernElement, GovernNode, Store, Subscription } from 'govern'


export interface SubscribeProps<T> {
  to: GovernElement<any, T> | Store<T>,
  children: (value: T, dispatch: Function) => React.ReactNode,
}


/**
 * A factory to create a `<Subscribe to>` React element, with typing.
 * @param store The store to subscribe to
 * @param children A function to render each of the store's values.
 */
export function createSubscribe<T>(
  store: GovernElement<any, T> | Store<T>,
  children: (value: T, dispatch: Function) => React.ReactNode
): React.ReactElement<SubscribeProps<T>> {
  return React.createElement(Subscribe, { to: store, children })
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
export class Subscribe extends React.Component<SubscribeProps<any>, { output: any, dummy: any, dispatch: any }> {
  priority: number
  store: Store<any>
  subscription: Subscription
  isDispatching: boolean
  isAwaitingRenderFromProps: boolean
  isAwaitingRenderFromFlush: boolean

  static contextTypes = {
    govern_priority: PropTypes.number,
  }

  static childContextTypes = {
    govern_priority: PropTypes.number,
  }
  
  constructor(props: SubscribeProps<any>, context) {
    super(props, context)
    this.state = {} as any
    this.isDispatching = false
    this.isAwaitingRenderFromProps = false

    if (context.govern_priority) {
      this.priority = context.govern_priority
    }
    else {
      this.priority = 1
    }
  }

  getChildContext() {
    return {
      govern_priority: this.priority + 1
    }
  }

  componentWillMount() {
    if (!this.props.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    this.store = instantiate(createElement(Flatten, { children: this.props.to }))
    
    this.handleChange(
      this.store.getValue(),
      this.store.UNSAFE_dispatch
    )

    // Create subsription within `componentWillMount` instead of in
    // `constructor`, as it is possible for components to have side effects
    // on initial subscription (as the first `componentDidFlush` is held
    // until then, and it can cause `setState`.
    this.subscription = this.store.subscribe(
      this.handleChange,
      this.receiveError,
      undefined,
      this.handleStartDispatch,
      this.handleEndDispatch,
      String(this.priority)
    )
  }

  componentWillReceiveProps(nextProps: SubscribeProps<any>) {
    if (!nextProps.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    // If no flush is received during dispatch, we'll want to re-render
    // manually when it completes.
    if (this.isDispatching) {
      this.isAwaitingRenderFromProps = true
    }

    // As elements are immutable, we can skip a lot of updates by
    // checking if the `to` element/store has changed.
    if (nextProps.to !== this.props.to) {
      this.store.setProps({
        children: nextProps.to,
      })
    }
  }

  componentDidCatch(error) {
    this.cleanup()
  }

  componentWillUnmount() {
    this.cleanup()
  }

  receiveError = (error) => {
    // Grab errors from the store, and throw them so a higher level React
    // component can handle it with componentDidCatch.
    throw error
  }

  cleanup() {
    if (this.store) {
      this.subscription.unsubscribe()
      this.store.dispose()
      delete this.subscription
      delete this.store
    }
  }

  shouldComponentUpdate() {
    return !this.isDispatching || this.isAwaitingRenderFromFlush
  }

  render() {
    this.isAwaitingRenderFromFlush = false
    this.isAwaitingRenderFromProps = false
    return this.props.children(this.state.output, this.state.dispatch)
  }

  handleChange = (output, dispatch) => {
    this.isAwaitingRenderFromFlush = true
    this.isAwaitingRenderFromProps = false
    this.setState({ output, dispatch })
  }

  handleStartDispatch = () => {
    this.isDispatching = true
  }

  handleEndDispatch = () => {
    this.isDispatching = false

    if (this.isAwaitingRenderFromProps) {
      // Now that `isDispatching` is false, `shouldComponentUpdate` will return
      // true, so we can flush through our changes by setting a dummy object.
      this.setState({ dummy: {} })
    }
  }
}

/**
 * A Govern component that accepts an element or store, instantiates and
 * updates props if required, and returns the output.
 */
function Flatten(props: { children: GovernNode }) {
  return props.children
}
