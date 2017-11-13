function doAction(key, fn, ...args) {
  const previousProps = this.props
  const previousState = this.state
  if (this.$isDestroyed) {
    if (process.env.NODE_ENV === "development") {
      console.error('You cannot call actions on a Govern Component instance that has been destroyed.')
    }
    return
  }
  if (this.$runningActions[key]) {
    if (process.env.NODE_ENV === "development") {
      console.error(`Stubbornly refusing to start running action ${key} that has already run since the previous update. If you really want to recurse, do so outside of your actions.`)
    }
    return
  }

  this._govern_doIncreaseTransactionLevel()
  this.$runningActions[key] = true
  const result = fn.apply(this, args)
  if (result instanceof Promise) {
    const handler = () => this._govern_doDecreaseTransactionLevel(previousProps, previousState)
    result.then(handler, handler)
  }
  else {
    this._govern_doDecreaseTransactionLevel(previousProps, previousState)
  }
  return result
}

function addDefaultProps(defaultProps, props) {
  const output = Object.assign({}, props)
  if (defaultProps) {
    for (let key of Object.keys(defaultProps)) {
      if (props[key] === undefined) {
        output[key] = defaultProps[key]
      }
    }
  }
  return output
}

export class StatefulComponent {
  constructor(props) {
    this.$props = props
    this.$isDestroyed = false
    this.$listeners = []

    this.$runningActions = {}
    this.$runningPropsUpdate = false

    this.$transactionLevel = 0

    // TODO: deprecate static actions setter in favor of this.bindActions
    this.actions = {}
    const actionTemplates = this.constructor.actions || {}
    const actionKeys = Object.keys(actionTemplates)
    for (let key of actionKeys) {
      this.actions[key] = doAction.bind(this, key, actionTemplates[key])
    }
    Object.freeze(this.actions)
  }

  bindAction(key) {
    return doAction.bind(this, key, this[key])
  }

  bindActions(...actionKeys) {
    let result = {}
    for (let key of actionKeys) {
      result[key] = this.bindAction(key)
    }
    return Object.freeze(result)
  }


  //
  // Internal API
  //

  get props()       { return this.$props }

  setState(state) {
    if (this.$isDestroyed) {
      console.error('You cannot call `setState` on a Govern Component instance that has been destroyed. Skipping setState.')
      return
    }

    this._govern_doStateUpdate(state)
  }


  //
  // Overridable by subclass
  //

  shouldCalculateOutput(previousProps, previousState) {
    return true
  }

  // TODO: deprecate default output
  output() {
    return Object.assign({
      actions: this.actions,
    }, this.state)
  }

  reconcile(a, b) {
    return false
  }

  //
  // Govern Controller API
  //

  createGovernController() {
    // Need to cache the output in case `get` is called before any other
    // changes occur.
    this._govern_cachedOutput = this.output()
    if (!this.state) {
      this.state = {}
    }
    Object.freeze(this.state)

    return {
      // Outlet
      get: () => this._govern_cachedOutput,
      subscribe: (change, transactionStart, transactionEnd, destroy) => {
        const callbacks = { change, transactionStart, transactionEnd, destroy }
        this.$listeners.push(callbacks)
        return () => {
          const index = this.$listeners.indexOf(callbacks)
          if (index !== -1) {
            this.$listeners.splice(index, 1)
          }
        }
      },

      // Controller
      set: (props) => {
        if (this.$isDestroyed) {
          console.error('You cannot call `set` on a Govern Controller instance that has been destroyed. Skipping.')
          return
        }

        const propsWithDefaults = addDefaultProps(this.constructor.defaultProps, props)
        if (this.$runningPropsUpdate) {
          this.$runningPropsUpdate.push(propsWithDefaults)
          return
        }
        this.$runningPropsUpdate = [propsWithDefaults]

        const previousProps = this.props
        const previousState = this.state
        this._govern_doIncreaseTransactionLevel()
        this._govern_changedInTransaction = true
        if (this.componentWillReceiveProps) {
          let receivedProps
          while (receivedProps = this.$runningPropsUpdate.shift()) {
            this.componentWillReceiveProps(receivedProps)
            this.$props = receivedProps
          }
        }
        else {
          this.$props = this.$runningPropsUpdate[0]
        }
        this.$runningPropsUpdate = false
        this._govern_doDecreaseTransactionLevel(previousProps, previousState)
      },
      destroy: () => {
        if (this.componentWillBeDestroyed) {
          this.componentWillBeDestroyed()
        }
        this.$listeners.length = 0
        this._govern_cachedOutput = null
        this.$isDestroyed = true
      },
    }
  }

  //
  // Implementation details
  //

  _govern_doStateUpdate(update) {
    const previousProps = this.props
    const previousState = this.state
    const mergedState = Object.assign({}, this.state, update)
    this._govern_doIncreaseTransactionLevel()
    this._govern_changedInTransaction = true
    this.state = Object.freeze(mergedState)
    this._govern_doDecreaseTransactionLevel(previousProps, previousState)
  }

  _govern_doIncreaseTransactionLevel() {
    if (++this.$transactionLevel == 1) {
      this._govern_changedInTransaction = false
      for (let { transactionStart } of this.$listeners) {
        if (transactionStart) transactionStart()
      }
    }
  }

  _govern_doDecreaseTransactionLevel(previousProps, previousState) {
    if (--this.$transactionLevel == 0) {
      if (this._govern_changedInTransaction) {
        if (this.shouldCalculateOutput(previousProps, previousState)) {
          const newOutput = this.output()
          this._govern_cachedOutput = newOutput
          for (let { change } of this.$listeners) {
            change(newOutput)
          }
        }
      }

      let toUnlock = Object.keys(this.$runningActions)
      const unlock = () => {
        for (let key of toUnlock) {
          delete this.$runningActions[key]
        }
        toUnlock.length = 0
      }

      for (let { transactionEnd } of this.$listeners) {
        if (transactionEnd) transactionEnd(unlock)
      }
    }
  }
}


export class PureStatefulComponent extends StatefulComponent {
  shouldCalculateOutput(previousProps, previousState) {
    return !shallowCompare(this.props, previousProps) || !shallowCompare(this.state, previousState)
  }
}

function shallowCompare(a, b) {
  var aIsNull = a === null
  var bIsNull = b === null

  if (aIsNull !== bIsNull) return false

  var aIsArray = Array.isArray(a)
  var bIsArray = Array.isArray(b)

  if (aIsArray !== bIsArray) return false

  var aTypeof = typeof a
  var bTypeof = typeof b

  if (aTypeof !== bTypeof) return false
  if (flat(aTypeof)) return a === b

  return aIsArray
    ? shallowArray(a, b)
    : shallowObject(a, b)
}

function shallowArray(a, b) {
  var l = a.length
  if (l !== b.length) return false

  for (var i = 0; i < l; i++) {
    if (a[i] !== b[i]) return false
  }

  return true
}

function shallowObject(a, b) {
  var ka = 0
  var kb = 0

  for (var key in a) {
    if (
      a.hasOwnProperty(key) &&
      a[key] !== b[key]
    ) return false

    ka++
  }

  for (var key in b) {
    if (b.hasOwnProperty(key)) kb++
  }

  return ka === kb
}

function flat(type) {
  return (
    type !== 'function' &&
    type !== 'object'
  )
}