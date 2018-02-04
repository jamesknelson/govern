import * as React from 'react'
import * as Govern from 'govern'
import { Subscription, Observable } from 'outlets'


export interface ConnectProps {
  to: Observable<any>,
  children: (value: any) => React.ReactNode,
}


/**
 * Accepts an observable as a prop, and passes each of its values to the
 * component's children via a render function.
 */
export class Connect extends React.Component<ConnectProps, { output: any, dummy: any }> {
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

  componentWillReceiveProps(nextProps) {
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

  reset(props: ConnectProps) {
    this.resetCount++

    this.subscription = undefined
    this.transactionLevel = 0
    this.changesExist = false
    this.sequenceNumber = 1

    // Set `isResetting` to true around our call to subscribe, so that the
    // initial change handler knows it doesn't need to start a wrapper
    // transaction
    this.isResetting = true
    this.subscription = props.to.subscribe(
      this.handleChange,
      this.handleTransactionStart,
      this.handleTransactionEnd
    )
    this.isResetting = false
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