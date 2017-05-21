import React, { Component } from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'


// The `controlledBy` decorator links its argument controllers' inputs to the
// props of the associated component.
//
// It wouldn't makes sense for a single controller to receive the input of two
// components. With this in mind, components used with `controlledBy` are
// added to this registry so that a warning can be made if they're used twice.
const globalLinkedControllers = new WeakMap

/**
 * Subscribe to one or more controllers while the component, feeding the
 * component props into the controllers as input.
 *
 * If a single prop name is passed in, the controller's output will be
 * injected directly onto the component's props. If an array of prop names is
 * passed in, each controller's output will be injected on a prop with
 * matching name.
 */
export default function connectControllers(controllerPropNames) {
  const isSingleton = !Array.isArray(controllerPropNames) && controllerPropNames

  if (isSingleton) {
    controllerPropNames = [controllerPropNames]
  }

  if (controllerPropNames.indexOf('$flush') !== -1) {
    throw new Error('controllerPropNames: The controller name `$flush` is reserved.')
  }

  return WrappedComponent => {
    class ControlledByProps extends Component {
      constructor(props) {
        super(props)

        this.state = {}
        this.unsubscribers = {}

        // Keep track of the number of controllers that are currently running
        // actions, and thus may cause side effects that involve changes
        // to the environment or changes emitted via onChange
        this.transactionLevel = 0

        // Keep track of the number of transactions that have been started
        // during flush, so that we can wait for them all to exit before
        // considering the flush to be complete
        this.flushLevel = 0

        // Keep controller actions locked until all controllers leave their
        // transactiosn
        this.unlockQueue = []

        // Keep track of whether there have been any changes since the last
        // flush, to make sure that empty transactions don't cause a re-render
        this.changesExist = false
      }

      componentWillMount() {
        const outputs = {}
        for (let key of controllerPropNames) {
          const controller = this.props[key]
          if (controller) {
            outputs[key] = this.subscribe(key, controller, this.props)
          }
        }
        this.setState(outputs)
      }

      componentWillReceiveProps(nextProps) {
        const newOutputs = {}
        let haveNewOutputs = false

        for (let key of controllerPropNames) {
          const prevController = this.props[key]
          const nextController = nextProps[key]

          if (prevController && (!nextController || nextController !== prevController)) {
            this.unsubscribe(key, prevController)
            newOutputs[key] = null
            haveNewOutputs = true
          }
          if (nextController) {
            if (nextController !== prevController) {
              newOutputs[key] = this.subscribe(key, nextController, nextProps)
              haveNewOutputs = true
            }
            else {
              // TODO
              // This can cause the props fed into this component to change,
              // and I *believe* this will queue another
              // componentWillReceiveProps for later instead of nested calls.
              // I need to confirm this.
              // This can also cause calls to `handleChange`, but this is fine
              // as it will already complain if transaction level is 0.
              nextController.set(nextProps)
            }
          }
        }

        if (haveNewOutputs) {
          this.setState(newOutputs)
        }
      }

      componentWillUnmount() {
        for (let key of controllerPropNames) {
          const controller = this.props[key]
          if (controller) {
            this.unsubscribe(key, controller)
          }
        }
      }

      shouldComponentUpdate() {
        return this.transactionLevel === 0
      }

      render() {
        const inject = isSingleton ? this.state[isSingleton] : this.state

        return React.createElement(WrappedComponent, {
          ...this.props,
          ...inject,
        })
      }

      subscribe(key, controller, props) {
        controller.set(props)

        const otherKey = globalLinkedControllers.get(controller)
        if (otherKey) {
          console.warn(`controlledBy: A controller has been mounted twice, with the keys "${key}" and "${otherKey}".`)
        }
        globalLinkedControllers.set(controller, key)

        this.unsubscribers[key] = controller.subscribe(
          this.handleChange.bind(this, key),
          this.handleTransactionStart,
          this.handleTransactionEnd
        )

        return controller.get()
      }

      unsubscribe(key, controller) {
        globalLinkedControllers.delete(controller)
        const unsubscriber = this.unsubscribers[key]
        if (unsubscriber) {
          unsubscriber()
          delete this.unsubscribers[key]
        }
      }

      handleChange(key, newState) {
        if (this.transactionLevel === 0) {
          throw new Error('controlledBy: A Controller may not emit a change without first starting a transaction.')
        }
        if (this.flushLevel !== 0) {
          throw new Error('controlledBy: A Controller may not change its output while flushing changes to the component.')
        }

        this.changesExist = true

        this.setState({
          [key]: newState,
        })
      }

      handleTransactionStart = () => {
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
      }

      handleTransactionEnd = (unlock) => {
        // The flush level can only be positive if the transaction was started
        // during a flush.
        if (this.flushLevel > 0) {
          --this.flushLevel
        }

        // Prevents actions on controllers from being called again until
        // the flush is complete, even if the flush doesn't happen this tick.
        this.unlockQueue.push(unlock)

        if (--this.transactionLevel === 0 && this.changesExist) {
          ++this.flushLevel
          this.changesExist = false
          this.setState({ $flush: {} }, () => {
            --this.flushLevel
            this.unlockQueue.forEach(unlock => unlock())
            this.unlockQueue.length = 0
          })
        }
      }
    }

    hoistNonReactStatics(ControlledByProps, WrappedComponent)

    return ControlledByProps
  }
}

