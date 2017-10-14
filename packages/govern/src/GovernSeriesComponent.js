import { createController } from './GovernController'


export default class SeriesComponent {
  constructor(props) {
    this.$isDestroyed = false
    this.$listeners = []
    this.$unlockQueue = []
    this.$childUnsubscribers = []
    this.$changeCount = 0

    this.$totalTransactionLevel = 0
    this.$mainTransactionLevel = 0
    this.$leftTransactionLevel = 0
    this.$rightTransactionLevel = 0

    this.$props = props

    this.$leftInstance = createController(this.constructor.leftChild, this.$props)
    this.$leftOutput = this.$leftInstance.get()
    this.$rightInstance = createController(this.constructor.rightChild, this.$leftOutput)

    this.$handleLeftChange = this.$handleLeftChange.bind(this)
    this.$handleRightChange = this.$handleRightChange.bind(this)
    this.$handleLeftTransactionStart = this.$handleLeftTransactionStart.bind(this)
    this.$handleRightTransactionStart = this.$handleRightTransactionStart.bind(this)
    this.$handleLeftTransactionEnd = this.$handleLeftTransactionEnd.bind(this)
    this.$handleRightTransactionEnd = this.$handleRightTransactionEnd.bind(this)
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

  $get() {
    if (this.$listeners.length > 0) {
      return this.$output
    }

    this.$doIncreaseTransactionLevel('main')
    this.$changeCount = 1
    this.$leftOutput = this.$leftInstance.get()
    this.$doDecreaseTransactionLevel('main')
    return this.$output
  }

  $set(props) {
    if (this.$isDestroyed) {
      console.error('You cannot call `set` on a Govern Controller instance that has been destroyed. Skipping.')
      return
    }
    this.$props = this.$addDefaultProps(props)
    this.$doIncreaseTransactionLevel('main')
    this.$leftInstance.set(this.$props)
    if (this.$listeners.length === 0) {
      this.$leftOutput = this.$leftInstance.get()
    }
    this.$doDecreaseTransactionLevel('main')
  }

  $subscribe(change, transactionStart, transactionEnd) {
    if (this.$listeners.length === 0) {
      // Caches current values
      this.$get()

      this.$childUnsubscribers.push(
        this.$leftInstance.subscribe(
          this.$handleLeftChange,
          this.$handleLeftTransactionStart,
          this.$handleLeftTransactionEnd
        ),
        this.$rightInstance.subscribe(
          this.$handleRightChange,
          this.$handleRightTransactionStart,
          this.$handleRightTransactionEnd
        )
      )
    }

    const callbacks = { change, transactionStart, transactionEnd }
    this.$listeners.push(callbacks)

    return () => {
      const index = this.$listeners.indexOf(callbacks)
      if (index !== -1) {
        this.$listeners.splice(index, 1)
      }
      if (this.$listeners.length === 0) {
        for (let unsubscribe of this.$childUnsubscribers) {
          unsubscribe()
        }
        this.$childUnsubscribers.length = 0
      }
    }
  }

  $destroy() {
    this.$leftInstance.destroy()
    this.$rightInstance.destroy()

    this.$leftOutput = null
    this.$rightOutput = null
    this.$output = null

    this.$listeners.length = 0
    this.$isDestroyed = true
  }

  //
  // Implementation details
  //

  $handleLeftTransactionStart() {
    this.$doIncreaseTransactionLevel('left')
  }
  $handleRightTransactionStart() {
    this.$doIncreaseTransactionLevel('right')
  }
  $handleLeftChange(data) {
    this.$changeCount++
    this.$leftOutput = data
  }
  $handleRightChange(data) {
    this.$changeCount++
    this.$rightOutput = data
    this.$output = data
  }
  $handleLeftTransactionEnd(unlock) {
    this.$unlockQueue.push(unlock)
    this.$doDecreaseTransactionLevel('left')
  }
  $handleRightTransactionEnd(unlock) {
    this.$unlockQueue.push(unlock)
    this.$doDecreaseTransactionLevel('right')
  }

  $doIncreaseTransactionLevel(type) {
    this[`$${type}TransactionLevel`]++
    if (++this.$totalTransactionLevel === 1) {
      for (let { transactionStart } of this.$listeners) {
        if (transactionStart) {
          transactionStart()
        }
      }
    }
  }

  $doDecreaseTransactionLevel(type) {
    --this[`$${type}TransactionLevel`]
    --this.$totalTransactionLevel

    if (this.$changeCount > 0 && (type === 'main' || type === 'left') && this.$totalTransactionLevel === 0) {
      this.$rightInstance.set(this.$leftOutput)
      if (this.$listeners.length === 0) {
        this.$rightOutput = this.$rightInstance.get()
        this.$output = this.$rightOutput
      }
    }

    // Calling `set` on `rightInstance` may cause the right transaction level
    // to increase, so we need to check again.
    if (this.$totalTransactionLevel === 0) {
      if (this.$changeCount > 0) {
        for (let { change } of this.$listeners) {
          change(this.$output)
        }
        this.$changeCount = 0
      }

      let unlockQueue = this.$unlockQueue
      this.$unlockQueue = []
      const unlock = () => {
        for (let fn of unlockQueue) {
          fn()
        }
        unlockQueue.length = 0
      }

      for (let { transactionEnd } of this.$listeners) {
        if (transactionEnd) {
          transactionEnd(unlock)
        }
      }
    }
  }

  $addDefaultProps(props) {
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
}

export function createSeriesComponent(...children) {
  if (children.length === 1) {
    return children[0]
  }

  const Component = class extends SeriesComponent {}
  Component.leftChild = children.shift()
  Component.rightChild = children.shift()

  if (children.length) {
    return createSeriesComponent(Component, ...children)
  }
  return Component
}