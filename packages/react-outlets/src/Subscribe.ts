import * as React from 'react'
import { Outlet, Subscription } from 'outlets'


export function subscribe<T, WrappedProps=WrapperProps & T, WrapperProps=any>(
  mapPropsToOutlet: (props: WrapperProps) => Outlet<T>,
  mergeProps?: (output: T, ownProps: WrapperProps) => WrappedProps
): (component: React.ComponentType<WrappedProps>) => React.ComponentClass<WrapperProps>;

export function subscribe<T, WrappedProps=WrapperProps & T, WrapperProps=any>(
  outlet: Outlet<T>,
  mergeProps?: (output: T, ownProps: WrapperProps) => WrappedProps
): (component: React.ComponentType<WrappedProps>) => React.ComponentClass<WrapperProps>;

/**
 * A Higher Order Component version of the <Subscribe to /> component.
 */
export function subscribe(
  mapPropsToOutlet:
    ((props) => Outlet<any>) |
    Outlet<any>,
  mergeProps = (output, ownProps) => Object.assign({}, ownProps, output)
): (component: React.ComponentType<any>) => React.ComponentClass<any> {
  let mapFn = mapPropsToOutlet as (props) => Outlet<any>
  if (typeof mapFn !== 'function') {
    mapFn = (() => mapPropsToOutlet) as any
  }

  let decorator = (WrappedComponent: React.ComponentType<any>) =>
    // Use a class component instead of a stateless functional component so
    // that consumers can use refs if they need.
    class SubscribeWrapper extends React.Component<any> {
      render() {
        return createSubscribe(mapFn(this.props), value =>
          React.createElement(WrappedComponent, mergeProps(value, this.props))
        )
      }
    }
  
  return decorator
}


export interface SubscribeProps<T> {
  to: Outlet<T>,
  children: (value: T) => React.ReactNode,
}


/**
 * A factory to create a `<Subscribe to>` element, with typing.
 * @param outlet The outlet to subscribe to
 * @param children A function to render each of the outlet's values.
 */
export function createSubscribe<T>(outlet: Outlet<T>, children: (value: T) => React.ReactNode): React.ReactElement<SubscribeProps<T>> {
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
export class Subscribe extends React.Component<SubscribeProps<any>, { output: any, dummy: any }> {
  state = {} as any

  resetCount: number = 0
  isResetting: boolean
  subscription?: Subscription

  // Keep track of whteher our observable is in a transaction, and thus may
  // have side effects that involve changes to the environment, or may emit a
  // new value.
  transactionLevel: number

  // Keep track of whether there have been any changes since the last
  // flush, to make sure that empty transactions don't cause a re-render
  changesExist: boolean

  // Increments on changes
  sequenceNumber: number

  componentWillMount() {
    this.reset(this.props)
  }

  componentWillReceiveProps(nextProps: SubscribeProps<any>) {
    if (nextProps.to !== this.props.to && this.subscription) {
      this.subscription.unsubscribe()
      this.reset(nextProps)
    }
    if (this.transactionLevel !== 0 && nextProps.children !== this.props.children) {
      this.changesExist = true
    }
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe()
      this.subscription = undefined
    }
  }

  reset(props: SubscribeProps<any>) {
    this.resetCount++

    this.subscription = undefined
    this.transactionLevel = 0
    this.changesExist = false
    this.sequenceNumber = 1

    // Set `isResetting` to true around our call to subscribe, so that the
    // initial change handler knows it doesn't need to start a wrapper
    // transaction
    this.isResetting = true
    this.subscription = props.to.subscribe({
      next: this.handleChange,
      error: this.receiveError,
      transactionStart: this.handleTransactionStart,
      transactionEnd: this.handleTransactionEnd
    })
    this.isResetting = false
  }

  receiveError(error) {
    // Grab errors from the outlet, and throw them so a higher level React
    // component can handle it with componentDidCatch.
    throw error
  }

  shouldComponentUpdate() {
    return this.transactionLevel === 0
  }

  render() {
    return this.props.children(this.state.output)
  }

  handleChange = (output) => {
    ++this.sequenceNumber

    let isTransactionlessChange = this.transactionLevel === 0 && !this.isResetting
    if (isTransactionlessChange) {
      this.handleTransactionStart()
    }

    this.changesExist = true
    this.setState({ output })

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
    const prevResetCount = this.resetCount
    this.setState({ dummy: {} }, () => {
      // Ignore the callback if the controller was changed since setState was
      // called.
      if (prevResetCount === this.resetCount) {
        if (prevSeq !== this.sequenceNumber) {
          this.handleTransactionEnd()
        }
        else {
          this.completeTransaction()
        }
      }
    })
  }

  completeTransaction() {
    ++this.sequenceNumber

    if (--this.transactionLevel === 0) {
      if (this.changesExist) {
        const prevResetCount = this.resetCount
        this.changesExist = false

        // Now that transactionLevel is 0, `shouldComponentUpdate` will return
        // true, so we can flush through our changes by setting a dummy object.
        this.setState({ dummy: {} })
      }
    }
  }
}