import * as React from 'react'
import { createElement, getUniqueId, instantiate, GovernElement, GovernNode, Store, Subscription } from 'govern'


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
  isSubscribing: boolean
  store: Store<any>
  subscription: Subscription

  // Keep track of whteher our observable is in a transaction, and thus may
  // have side effects that involve changes to the environment, or may emit a
  // new value.
  transactionLevel: number

  // Keep track of whether there have been any changes since the last
  // flush, to make sure that empty transactions don't cause a re-render
  changesExist: boolean
  
  constructor(props: SubscribeProps<any>) {
    super(props)
    this.state = {} as any
    this.transactionLevel = 0
    this.changesExist = false
  }

  componentWillMount() {
    if (!this.props.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    // Create controllers within `componentWillMount` instead of in
    // `constructor`, as we can't rule out the possibility that
    // the controller will have some side effects on initialization.
    this.store = instantiate(createElement(Flatten, { children: this.props.to }))
    
    // Set `isSubscribing` to true around our call to subscribe, so that the
    // initial change handler knows it doesn't need to start a wrapper
    // transaction
    this.isSubscribing = true

    this.subscription = this.store.subscribe({
      next: this.handleChange,
      error: this.receiveError,
      complete: undefined,
      transactionStart: this.handleTransactionStart,
      transactionEnd: this.handleTransactionEnd
    })

    this.isSubscribing = false
  }

  componentWillReceiveProps(nextProps: SubscribeProps<any>) {
    if (!nextProps.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    // As elements are immutable, we can skip a lot of updates by
    // checking if the `to` element/store has changed.
    if (nextProps.to !== this.props.to) {
      let transactionId = getUniqueId()
      this.store.transactionStart(transactionId)
      this.store.setProps({
        children: nextProps.to,
      })
      this.store.transactionEnd(transactionId)

      // Ensure that re-rendering this component causes a re-render when we're
      // not in a transaction.
      if (this.transactionLevel !== 0) {
        this.changesExist = true
      }
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
    return this.transactionLevel === 0
  }

  render() {
    return this.props.children(this.state.output, this.state.dispatch)
  }

  handleChange = (output, dispatch) => {
    let isTransactionlessChange = this.transactionLevel === 0 && !this.isSubscribing
    if (isTransactionlessChange) {
      this.handleTransactionStart()
    }

    this.changesExist = true
    this.setState({ output, dispatch })

    if (isTransactionlessChange) {
      this.handleTransactionEnd()
    }
  }

  handleTransactionStart = () => {
    ++this.transactionLevel
  }

  handleTransactionEnd = () => {
    if (--this.transactionLevel === 0) {
      if (this.changesExist) {
        this.changesExist = false

        // Now that transactionLevel is 0, `shouldComponentUpdate` will return
        // true, so we can flush through our changes by setting a dummy object.
        this.setState({ dummy: {} })
      }
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
