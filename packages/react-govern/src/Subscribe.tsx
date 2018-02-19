import * as React from 'react'
import { createElement, getUniqueId, instantiate, GovernElement, GovernNode, Outlet, Subscription } from 'govern'


export interface SubscribeProps<T> {
  to: GovernElement<any, T> | Outlet<T>,
  children: (value: T, dispatch: Function) => React.ReactNode,
}


/**
 * A factory to create a `<Subscribe to>` React element, with typing.
 * @param outlet The outlet to subscribe to
 * @param children A function to render each of the outlet's values.
 */
export function createSubscribe<T>(
  outlet: GovernElement<any, T> | Outlet<T>,
  children: (value: T, dispatch: Function) => React.ReactNode
): React.ReactElement<SubscribeProps<T>> {
  return React.createElement(Subscribe, { to: outlet, children })
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
  outlet: Outlet<any>
  subscription: Subscription

  // Keep track of whteher our observable is in a transaction, and thus may
  // have side effects that involve changes to the environment, or may emit a
  // new value.
  transactionLevel: number

  // Keep track of whether there have been any changes since the last
  // flush, to make sure that empty transactions don't cause a re-render
  changesExist: boolean

  // Increments on changes
  sequenceNumber: number
  
  constructor(props: SubscribeProps<any>) {
    super(props)
    this.state = {} as any
    this.transactionLevel = 0
    this.changesExist = false
    this.sequenceNumber = 1
  }

  componentWillMount() {
    // Create controllers within `componentWillMount` instead of in
    // `constructor`, as we can't rule out the possibility that
    // the controller will have some side effects on initialization.
    this.outlet = instantiate(createElement(Flatten, { children: this.props.to }))
    
    // Set `isSubscribing` to true around our call to subscribe, so that the
    // initial change handler knows it doesn't need to start a wrapper
    // transaction
    this.isSubscribing = true

    this.subscription = this.outlet.subscribe({
      next: this.handleChange,
      error: this.receiveError,
      complete: undefined,
      transactionStart: this.handleTransactionStart,
      transactionEnd: this.handleTransactionEnd
    })

    this.isSubscribing = false
  }

  componentWillReceiveProps(nextProps: SubscribeProps<any>) {
    let transactionId = getUniqueId()
    this.outlet.transactionStart(transactionId)
    this.outlet.setProps({
      children: nextProps.to,
    })
    this.outlet.transactionEnd(transactionId)

    // Ensure that re-rendering this component causes a re-render when we're
    // not in a transaction.
    if (this.transactionLevel !== 0) {
      this.changesExist = true
    }
  }

  componentDidCatch(error) {
    this.cleanup()
  }

  componentWillUnmount() {
    this.cleanup()
  }

  receiveError(error) {
    this.cleanup()

    // Grab errors from the outlet, and throw them so a higher level React
    // component can handle it with componentDidCatch.
    throw error
  }

  cleanup() {
    if (this.outlet) {
      this.subscription.unsubscribe()
      this.outlet.dispose()
      delete this.subscription
      delete this.outlet
    }
  }

  shouldComponentUpdate() {
    return this.transactionLevel === 0
  }

  render() {
    return this.props.children(this.state.output, this.state.dispatch)
  }

  handleChange = (output, dispatch) => {
    ++this.sequenceNumber

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
    ++this.sequenceNumber
    ++this.transactionLevel
  }

  handleTransactionEnd = () => {
    // React usually doesn't immediately run `setState` calls, which means
    // that React may have queued updates that will result in the controller's
    // props being updated.
    //
    // React *does* generally run `setState` calls in order, which means we
    // can wait for all pending `setState` calls by executing an empty one
    // here and waiting for the callback. We need to do this recursively
    // until there are no changes, at which point we expect that there will be
    // no further changes and we can flush our changes to the next component.
    //
    // Note that by the time this is called, the observers's transaction has
    // already ended, so any further updates to observer props will trigger
    // a new transaction, and thus a new sequence number.
    const prevSeq = this.sequenceNumber
    this.setState({ dummy: {} }, () => {
      if (prevSeq !== this.sequenceNumber) {
        this.handleTransactionEnd()
      }
      else {
        this.completeTransaction()
      }
    })
  }

  completeTransaction() {
    ++this.sequenceNumber

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
 * A Govern component that accepts an element or outlet, instantiates and
 * updates props if required, and returns the output.
 */
function Flatten(props: { children: GovernNode }) {
  return props.children
}
