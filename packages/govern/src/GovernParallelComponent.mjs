import { createController } from './GovernController'


export default class ParallelComponent {
  constructor(props) {
    this.$_isDestroyed = false
    this.$_listeners = []
    this.$_transactionLevel = 0
    this.$_unlockQueue = []

    this.$_childInstances = {}
    this.$_childUnsubscribers = []
    const children = this.constructor.children
    const childKeys = Object.keys(children)
    for (let key of childKeys) {
      const component = children[key]
      this.$_childInstances[key] = createController(component, props)
    }
    Object.freeze(this.$_childInstances)

    this.$_handleTransactionStart = this.$_handleTransactionStart.bind(this)
    this.$_handleTransactionEnd = this.$_handleTransactionEnd.bind(this)
  }

  //
  // Govern Component API
  //

  createGovernController() {
    return {
      // Outlet
      get: this.$get.bind(this),
      subscribe: this.$subscribe.bind(this),

      // Controller
      set: this.$set.bind(this),
      destroy: this.$destroy.bind(this),
    }
  }

  $set(props) {
    if (this.$_isDestroyed) {
      console.error('You cannot call `set` on a Govern Controller instance that has been destroyed. Skipping.')
      return
    }

    this.$_doPropsUpdate(props)
  }

  $get() {
    // Child outputs may change without notifying us, as this component won't
    // be listening for changes on children unless there is somebody listening
    // to us.
    //
    // Because of this, we'll need to check to see if any child outputs have
    // changed. If they haven't, used our cached output to enable reference
    // equality checks. Otherwise, compute a new output.
    if (this.$_listeners.length === 0) {
      this.$_setCachedOutput()
    }

    return this.$_cachedOutput
  }

  $subscribe(change, transactionStart, transactionEnd) {
    if (this.$_listeners.length === 0) {
      const childKeys = Object.keys(this.$_childInstances)
      for (let key of childKeys) {
        this.$_childUnsubscribers.push(
          this.$_childInstances[key].subscribe(
            this.$_handleChange.bind(this, key),
            this.$_handleTransactionStart,
            this.$_handleTransactionEnd
          )
        )
      }

      this.$_changeCount = 0
      this.$_setCachedOutput()
    }

    const callbacks = { change, transactionStart, transactionEnd }
    this.$_listeners.push(callbacks)

    return () => {
      const index = this.$_listeners.indexOf(callbacks)
      if (index !== -1) {
        this.$_listeners.splice(index, 1)
      }
      if (this.$_listeners.length === 0) {
        for (let unsubscribe of this.$_childUnsubscribers) {
          unsubscribe()
        }
        this.$_childUnsubscribers.length = 0
      }
    }
  }

  $destroy() {
    for (let instance of Object.values(this.$_childInstances)) {
      instance.destroy()
    }

    this.$_cachedOutput = null
    this.$_listeners.length = 0
    this.$_isDestroyed = true
  }

  //
  // Implementation details
  //

  $_handleChange(key, data) {
    this.$_changeCount++
    this.$_cachedOutput = Object.assign({}, this.$_cachedOutput, { [key]: data })
  }
  $_handleTransactionStart() {
    this.$_doIncreaseTransactionLevel()
  }
  $_handleTransactionEnd(unlock) {
    this.$_unlockQueue.push(unlock)
    this.$_doDecreaseTransactionLevel()
  }

  $_setCachedOutput() {
    this.$_doIncreaseTransactionLevel()
    const children = {}
    const childKeys = Object.keys(this.$_childInstances)
    for (let key of childKeys) {
      const output = this.$_childInstances[key].get()
      children[key] = output
    }
    this.$_cachedOutput = children
    this.$_doDecreaseTransactionLevel()
  }

  $_addDefaultProps(props) {
    const output = Object.assign({}, props)
    const defaultProps = this.constructor.defaultProps
    if (defaultProps) {
      for (let key of Object.keys(defaultProps)) {
        if (props[key] === undefined) {
          output[key] = defaultProps[key]
        }
      }
    }
    return output
  }

  // This actually performs the props update. It assumes that all conditions to
  // perform an props update have been met.
  $_doPropsUpdate(props) {
    const propsWithDefaults = this.$_addDefaultProps(props)
    this.$_doIncreaseTransactionLevel()
    const children = {}
    for (let instance of Object.values(this.$_childInstances)) {
      instance.set(propsWithDefaults)
    }
    if (this.$_listeners.length === 0) {
      this.$_setCachedOutput()
    }
    this.$_doDecreaseTransactionLevel()
  }

  $_doIncreaseTransactionLevel() {
    if (++this.$_transactionLevel == 1) {
      for (let { transactionStart } of this.$_listeners) {
        transactionStart()
      }
    }
  }

  $_doDecreaseTransactionLevel() {
    if (--this.$_transactionLevel == 0) {
      if (this.$_changeCount > 0) {
        for (let { change } of this.$_listeners) {
          change(this.$_cachedOutput)
        }
        this.$_changeCount = 0
      }

      let unlockQueue = this.$_unlockQueue
      this.$_unlockQueue = []
      const unlock = () => {
        for (let fn of unlockQueue) {
          fn()
        }
        unlockQueue.length = 0
      }

      for (let { transactionEnd } of this.$_listeners) {
        transactionEnd(unlock)
      }
    }
  }
}

export function createParallelComponent(children) {
  const Component = class extends ParallelComponent {}
  Component.children = children
  return Component
}