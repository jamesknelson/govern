import React, { Component } from 'react'
import { createController } from 'govern'
import hoistNonReactStatics from 'hoist-non-react-statics'


/**
 * A HoC to create and destroy a Govern Component of the given type with the
 * wrapped component.
 *
 * The props for the returned component are fed to the Govern Component, with
 * its output injected into the wrapped componend via `<Subscribe>`.
 */
export default function controlledBy(governComponent) {
  return WrappedComponent => {
    class ControlledBy extends Component {
      constructor(props) {
        super(props)

        this.state = {}
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
        this.unlockQueue = []

        // Keep track of whether there have been any changes since the last
        // flush, to make sure that empty transactions don't cause a re-render
        this.changesExist = false

        // Increments every time any changes occurs within
        this.sequenceNumber = 1

        // Changes cannot be prevented during a mount
        this.preventChanges = false

        this.handleChange = this.handleChange.bind(this)
        this.handleTransactionStart = this.handleTransactionStart.bind(this)
        this.handleTransactionEnd = this.handleTransactionEnd.bind(this)
      }

      componentWillMount() {
        ++this.sequenceNumber

        this.controller = createController(governComponent, this.props)

        this.unsubscriber = this.controller.subscribe(
          this.handleChange,
          this.handleTransactionStart,
          this.handleTransactionEnd
        )

        this.setState(
          { output: this.controller.get() },
          () => { this.preventChanges = true }
        )
      }

      componentWillReceiveProps(nextProps) {
        ++this.sequenceNumber

        // Note that this can cause the props for this component to be updated.
        // In this case, React will queue another call to
        // componentWillReceiveProps instead of making nested calls, and the
        // setState callback in `handleTransactionEnd` will alloy any further
        // props to be captured before flushing an update through children.
        this.controller.set(nextProps)
      }

      componentWillUnmount() {
        if (this.unsubscriber) {
          this.unsubscriber()
          this.unsubscriber = undefined
        }

        this.controller.destroy()
      }

      shouldComponentUpdate() {
        return this.transactionLevel === 0 && this.preventChanges === false
      }

      render() {
        return React.createElement(WrappedComponent, this.state.output)
      }

      handleChange(key, output) {
        ++this.sequenceNumber

        if (this.transactionLevel === 0) {
          throw new Error('controlledBy: A Controller may not emit a change without first starting a transaction.')
        }
        if (this.flushLevel !== 0 && this.preventChanges) {
          console.error(this.state.output, output)
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

      handleTransactionEnd = (unlock) => {
        // React doesn't always immediately run `setState` calls, which means
        // that there may still be pending prop updates that result from
        // already executed code.
        //
        // React does seem to run `setState` calls in order, which means we
        // can wait for all pending `setState` calls by executing an empty one
        // here and waiting for the callback. We need to do this recursively
        // until there are no changes, at which point we know there will be no
        // further changes and we can flush our changes to the next component.
        const prevSeq = this.sequenceNumber
        this.setState({ $waitingForChanges: {} }, () => {
          if (this.sequenceNumber !== prevSeq) {
            this.handleTransactionEnd(unlock)
          }
          else {
            this.completeTransaction(unlock)
          }
        })
      }

      completeTransaction(unlock) {
        ++this.sequenceNumber

        // The flush level can only be positive if the transaction was started
        // during a flush.
        if (this.flushLevel > 0) {
          --this.flushLevel
        }

        // Prevents actions on Govern Components from being called again until
        // the flush is complete, even if the flush doesn't happen this tick.
        this.unlockQueue.push(unlock)

        if (--this.transactionLevel === 0) {
          if (this.changesExist) {
            ++this.flushLevel

            this.changesExist = false
            // Ensure that any prop updates we receive while flushing are
            // not caused by children by setting up a dummy flush,
            // and throw an error if any updates are received after its
            // callback is executed. Any updates that are already queued
            // should be received before its callback
            this.preventChanges = false
            this.setState({ $dummy: {} }, () => {
              this.preventChanges = true
            })
            this.setState({ $flush: {} }, () => {
              --this.flushLevel
              this.unlockQueue.forEach(unlock => unlock())
              this.unlockQueue.length = 0
            })
          }
          else {
            // TODO:
            // - what if the input props have changed, but outputs didn't?
            //   this can happen if a controller causes side effects on
            //   globals like history, etc. before flush

            this.unlockQueue.forEach(unlock => unlock())
            this.unlockQueue.length = 0
          }
        }
      }
    }

    hoistNonReactStatics(ControlledBy, WrappedComponent)

    return ControlledBy
  }
}
