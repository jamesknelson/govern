import React from 'react'
// import PropTypes from 'prop-types'


/**
 * A component that subscribes to the specified controller
 * wrapped component.
 *
 * The props for the returned component are fed to the Govern Component, with
 * its output injected into the wrapped componend via `<Subscribe>`.
 */
export default class Subscribe extends React.Component {
  // static propTypes = {
  //   // A controller
  //   to: PropTypes.any.isRequired,

  //   // A function to render the output
  //   render: PropTypes.func.isRequired,
  // }

  constructor(props) {
    super(props)

    this.state = {}
    this.resetCount = 0

    this.handleChange = this.handleChange.bind(this)
    this.handleTransactionStart = this.handleTransactionStart.bind(this)
    this.handleTransactionEnd = this.handleTransactionEnd.bind(this)
  }

  componentWillMount() {
    this.reset(this.props)
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.to !== this.props.to) {
      this.unsubscriber()
      this.reset(nextProps)
    }
  }

  componentWillUnmount() {
    this.unsubscriber()
    this.unsubscriber = undefined
  }

  reset(props) {
    this.resetCount++

    this.unsubscriber = null

    // Keep track of the number of controller that are currently running
    // actions, and thus may cause side effects that involve changes
    // to the environment or changes emitted via onChange
    this.transactionLevel = 0

    // Keep track of the number of transactions that have been started
    // during flush, so that we can wait for them all to exit before
    // considering the flush to be complete
    this.flushLevel = 0

    // Keep controller actions locked until all controller leave their
    // transactiosn
    this.confirmQueue = []

    // Keep track of whether there have been any changes since the last
    // flush, to make sure that empty transactions don't cause a re-render
    this.changesExist = false

    // Increments every time any changes occurs within
    this.sequenceNumber = 1

    // Changes cannot be prevented during a mount
    this.preventChanges = false

    this.unsubscriber = props.to.subscribe(
      this.handleChange,
      this.handleTransactionStart,
      this.handleTransactionEnd
    )

    this.setState(
      { output: props.to.get() },
      () => { this.preventChanges = true }
    )
  }

  shouldComponentUpdate() {
    return this.transactionLevel === 0 && this.preventChanges === false
  }

  render() {
    return React.createElement(this.props.render, this.state.output)
  }

  handleChange(output) {
    ++this.sequenceNumber

    if (this.transactionLevel === 0) {
      throw new Error('controlledBy: A Controller may not emit a change without first starting a transaction.')
    }
    if (this.flushLevel !== 0 && this.preventChanges) {
      console.error("A controller tried to change its output while flushing changes to a React Component via <Subscribe> or controlledBy.")
      console.error("Original output:", this.state.output)
      console.error("New output", output)
      throw new Error('controlledBy: A Controller may not change its output while flushing changes to the component.')
    }

    this.changesExist = true

    this.setState({ output })
  }

  handleTransactionStart = () => {
    ++this.sequenceNumber
    ++this.transactionLevel

    // If we're flushing when the transaction starts, we want to make sure
    // that the transaction finishes before any more changes occur, even
    // if the transaction doesn't finish until after the flush completes.
    //
    // This helps to ensure we don't get async infinite loops by ensuring
    // that an error is thrown if handleChange due to an async transaction
    // that was started during flush.
    if (this.flushLevel > 0) {
      ++this.flushLevel
    }
    else {
      this.preventChanges = false
    }
  }

  handleTransactionEnd = (confirm) => {
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
    // Note that by the time this is called, the controller's transaction has
    // already ended, so any further updates to controller props will trigger
    // a new transaction, and thus a new sequence number.
    const prevSeq = this.sequenceNumber
    const prevResetCount = this.resetCount
    this.setState({ $waitingForChanges: {} }, () => {
      // Ignore the callback if the controller was changed since setState was
      // called.
      if (prevResetCount === this.resetCount) {
        if (this.sequenceNumber !== prevSeq) {
          this.handleTransactionEnd(confirm)
        }
        else {
          this.completeTransaction(confirm)
        }
      }
    })
  }

  completeTransaction(confirm) {
    ++this.sequenceNumber

    // The flush level can only be positive if the transaction was started
    // during a flush.
    if (this.flushLevel > 0) {
      --this.flushLevel
    }

    // Prevents actions on Govern Components from being called again until
    // the flush is complete, even if the flush doesn't happen this tick.
    this.confirmQueue.push(confirm)

    if (--this.transactionLevel === 0) {
      if (this.changesExist) {
        ++this.flushLevel

        const prevResetCount = this.resetCount

        this.changesExist = false
        // Ensure that any prop updates we receive while flushing are
        // not caused by children by setting up a dummy flush,
        // and throw an error if any updates are received after its
        // callback is executed. Any updates that are already queued
        // should be received before its callback
        this.preventChanges = false
        this.setState({ $dummy: {} }, () => {
          if (prevResetCount !== this.resetCount) {
            return
          }
          this.preventChanges = true
        })
        this.setState({ $flush: {} }, () => {
          if (prevResetCount !== this.resetCount) {
            return
          }

          --this.flushLevel
          this.confirmQueue.forEach(confirm => confirm())
          this.confirmQueue.length = 0
        })
      }
      else {
        // TODO:
        // - what if the input props have changed, but outputs didn't?
        //   this can happen if a controller causes side effects on
        //   globals like history, etc. before flush

        this.confirmQueue.forEach(confirm => confirm())
        this.confirmQueue.length = 0
      }
    }
  }
}