import { StatefulComponent } from './GovernBaseClasses'

const noop = () => {}

/**
 * A Govern Component that looks for a Controller object on its `controller`
 * prop, and subscribes to, taking the controller's output as its own.
 *
 * Other props will be ignored; they *will not* be set as values on the
 * passed-in controller.
 *
 * If no passed-in controller exists, this component will have an empty output.
 *
 * This component will also forward transaction messages from the subscribed
 * component.
 */
export default class SubscriberBase extends StatefulComponent {
  constructor(props) {
    super(props)
    this.controller = this.constructor.controllerGetter(props)
    this.subscribers = []
    this.enqueuedDoneCallbacks = []
    this.transactionLevel = 0
  }

  createGovernController() {
    return {
      get: this.get,
      subscribe: this.subscribe,
      set: this.set,
      destroy: this.destroy,
    }
  }

  get = () =>
    this.subscribers.length
      ? this.output
      : this.controller && this.controller.get()

  subscribe = (change, transactionStart, transactionEnd, destroy) => {
    const callbacks = { change, transactionStart, transactionEnd, destroy }
    this.subscribers.push(callbacks)
    if (this.controller && !this.childSubscription) {
      this.subscribeToChild()
    }
    return this.unsubscribe.bind(this, callbacks)
  }
  unsubscribe(callbacks) {
    const index = this.subscribers.indexOf(callbacks)
    if (index !== -1) {
      this.subscribers.splice(index, 1)
      if (this.childSubscription && this.subscribers.length === 0) {
        this.unsubscribeFromChild()
      }
    }
  }

  set = (nextProps) => {
    if (this.isDestroyed) {
      console.error('You cannot call `set` on a Govern Controller instance that has been destroyed. Skipping.')
      return
    }

    const nextController = this.constructor.controllerGetter(nextProps)
    if (nextController !== this.controller) {
      this.handleTransactionStart()
      if (this.childSubscription) {
        this.unsubscribeFromChild()
      }
      this.controller = nextController
      if (nextController && this.subscribers.length) {
        this.subscribeToChild()
        this.handleChange(this.output)
      }
      else {
        this.handleChange(null)
      }
      this.handleTransactionEnd(noop)
    }
  }

  destroy = () => {
    if (this.childSubscription) {
      this.unsubscribeFromChild()
    }
    while (this.transactionLevel > 0) {
      this.handleTransactionEnd(noop)
    }
    this.notify('destroy')
    this.isDestroyed = true
    this.subscribers.length = 0
    this.output = null
    this.controller = null
  }

  handleChange = (value) => {
    this.output = value
    this.notify('change', value)
  }

  handleTransactionStart = () => {
    if (this.transactionLevel > 0) {
      return
    }
    this.transactionLevel++
    this.notify('transactionStart')
  }

  handleTransactionEnd = (done) => {
    this.transactionLevel--
    this.enqueuedDoneCallbacks.push(done)
    if (this.transactionLevel > 0) {
      return
    }

    const doneCallbacks = this.enqueuedDoneCallbacks.slice(0)
    this.enqueuedDoneCallbacks.length = 0

    this.notify('transactionEnd', () => {
      for (let callback of doneCallbacks) {
        callback()
      }
    })
  }

  handleDestroy = () => {
    if (this.childSubscription) {
      this.childSubscription = null
    }

    this.handleTransactionStart()
    this.handleChange(null)
    this.handleTransactionEnd(noop)
  }

  notify(key, ...props) {
    for (let i = 0; i < this.subscribers.length; i++) {
      const callback = this.subscribers[i][key]
      if (callback) {
        callback(...props)
      }
    }
  }
  subscribeToChild() {
    this.childSubscription = this.controller.subscribe(
      this.handleChange,
      this.handleTransactionStart,
      this.handleTransactionEnd,
      this.handleDestroy
    )
    this.output = this.controller.get()
  }
  unsubscribeFromChild() {
    this.childSubscription()
    this.childSubscription = null
  }
}


/**
 * Create a Govern Component that subscribes to a given prop, as opposed
 * to always looking on the `controller` prop.
 */
export function createSubscriberComponent(controllerGetter) {
  const Subscriber = class Subscriber extends SubscriberBase {}
  Subscriber.controllerGetter = controllerGetter
  return Subscriber
}
