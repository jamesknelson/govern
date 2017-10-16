import { createController } from './GovernController'


export default class SeriesComponent {
  constructor(props) {
    this.isInitialized = false
    this.isDestroyed = false
    this.listeners = []
    this.unlockQueue = []
    this.childSubscriptions = []

    this.leftChangeCount = 0
    this.rightChangeCount = 0
    this.totalChangeCount = 0

    this.totalTransactionLevel = 0
    this.mainTransactionLevel = 0
    this.leftTransactionLevel = 0
    this.rightTransactionLevel = 0

    this.scheduledProps = props
  }

  createGovernController() {
    return {
      get: this.get,
      subscribe: this.subscribe,
      set: this.set,
      destroy: this.destroy,
    }
  }

  get = () => {
    if (this.scheduledProps) {
      this.executeScheduledPropChange()
      return this.rightOutput
    }

    if (this.listeners.length > 0) {
      return this.rightOutput
    }

    this.increaseTransactionLevel('main')
    this.totalChangeCount++
    this.leftOutput = this.leftInstance.get()
    this.rightInstance.set(this.leftOutput)
    this.rightOutput = this.rightInstance.get()
    this.decreaseTransactionLevel('main')

    return this.rightOutput
  }

  set = (props) => {
    if (this.isDestroyed) {
      console.error('You cannot call `set` on a Govern Controller instance that has been destroyed. Skipping.')
      return
    }

    const propsWithDefaults = this.addDefaultProps(props)

    if (this.listeners.length > 0) {
      this.increaseTransactionLevel('main')
      // In a subscribed component, any changes on the left will cause the RHS
      // to be updated automatically.
      this.leftInstance.set(propsWithDefaults)
      this.decreaseTransactionLevel('main')
      return
    }

    if (this.scheduledProps) {
      this.executeScheduledPropChange()
    }
    this.scheduledProps = propsWithDefaults
  }

  subscribe = (change, transactionStart, transactionEnd, destroy) => {
    if (this.listeners.length === 0) {
      // subscribing may cause computation, so make sure both the children
      // have the most up to date props
      if (this.scheduledProps) {
        this.executeScheduledPropChange()
      }

      this.childSubscriptions = [
        this.leftInstance.subscribe(
          this.handleLeftChange,
          this.handleLeftTransactionStart,
          this.handleLeftTransactionEnd,
          this.handleLeftDestroy
        ),
        this.rightInstance.subscribe(
          this.handleRightChange,
          this.handleRightTransactionStart,
          this.handleRightTransactionEnd,
          this.handleRightDestroy
        )
      ]
    }

    const callbacks = { change, transactionStart, transactionEnd, destroy }
    this.listeners.push(callbacks)
    return this.unsubscribe.bind(this, callbacks)
  }
  unsubscribe(callbacks) {
    const index = this.listeners.indexOf(callbacks)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
    if (this.listeners.length === 0 && this.childSubscriptions.length) {
      this.unsubscribeFromChildren()
    }
  }

  destroy = () => {
    this.leftInstance.destroy()
    this.rightInstance.destroy()

    if (this.childSubscriptions.length) {
      this.unsubscribeFromChildren()
    }

    while (this.totalTransactionLevel > 0) {
      this.decreaseTransactionLevel('main')
    }

    for (let { destroy } of this.listeners) {
      if (destroy) {
        destroy()
      }
    }

    this.scheduledProps = null
    this.leftOutput = null
    this.rightOutput = null
    this.listeners.length = 0
    this.isDestroyed = true
  }

  //
  // Implementation details
  //

  handleLeftChange = (data) => {
    this.leftChangeCount++
    this.leftOutput = data
  }
  handleRightChange = (data) => {
    this.rightChangeCount++
    this.rightOutput = data
  }
  handleLeftTransactionStart = () => {
    this.increaseTransactionLevel('left')
  }
  handleRightTransactionStart = () => {
    this.increaseTransactionLevel('right')
  }
  handleLeftTransactionEnd = (unlock) => {
    this.unlockQueue.push(unlock)
    this.decreaseTransactionLevel('left')
  }
  handleRightTransactionEnd = (unlock) => {
    this.unlockQueue.push(unlock)
    this.decreaseTransactionLevel('right')
  }
  handleLeftDestroy = () => {}
  handleRightDestroy = () => {}


  executeScheduledPropChange() {
    const props = this.scheduledProps
    this.scheduledProps = null

    this.increaseTransactionLevel('main')
    this.totalChangeCount++
    if (!this.isInitialized) {
      this.isInitialized = true
      this.leftInstance = createController(this.constructor.leftChild, props)
      this.leftOutput = this.leftInstance.get()
      this.rightInstance = createController(this.constructor.rightChild, this.leftOutput)
    }
    else {
      this.leftInstance.set(props)
      this.leftOutput = this.leftInstance.get()
      this.rightInstance.set(this.leftOutput)
    }
    this.rightOutput = this.rightInstance.get()
    this.decreaseTransactionLevel('main')
  }


  increaseTransactionLevel(type) {
    this[`${type}TransactionLevel`]++
    if (type === 'right' && this[`${type}TransactionLevel`] === 2) {
      debugger
    }
    if (++this.totalTransactionLevel === 1) {
      for (let { transactionStart } of this.listeners) {
        if (transactionStart) {
          transactionStart()
        }
      }
    }
  }

  decreaseTransactionLevel(type) {
    --this[`${type}TransactionLevel`]
    --this.totalTransactionLevel

    // A left transaction can only start when subscribed, therefore rhs
    // will emit any changes
    if (type === 'left' && this.leftTransactionLevel === 0 && this.leftChangeCount) {
      // If this was triggered by a left update, then totalTransactionLevel
      // will be 0, triggering a new transaction. This hack prevents that.
      this.totalTransactionLevel++
      this.increaseTransactionLevel('main')
      this.leftChangeCount = 0
      this.rightInstance.set(this.leftOutput)
      this.totalTransactionLevel--
      this.decreaseTransactionLevel('main')
      return
    }
    else if (type === 'right' && this.rightTransactionLevel === 0 && this.rightChangeCount) {
      this.rightChangeCount = 0
      this.totalChangeCount++
    }

    if (this.totalTransactionLevel === 0) {
      if (this.totalChangeCount > 0) {
        for (let { change } of this.listeners) {
          change(this.rightOutput)
        }
        this.totalChangeCount = 0
      }

      let unlockQueue = this.unlockQueue.slice(0)
      this.unlockQueue.length = 0
      const unlock = () => {
        for (let fn of unlockQueue) {
          fn()
        }
        unlockQueue.length = 0
      }

      for (let { transactionEnd } of this.listeners) {
        if (transactionEnd) {
          transactionEnd(unlock)
        }
      }
    }
  }

  addDefaultProps(props) {
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

  unsubscribeFromChildren() {
    this.childSubscriptions[0]()
    this.childSubscriptions[1]()
    this.childSubscriptions.length = 0
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