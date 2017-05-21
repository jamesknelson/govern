/**
 * PureController aims to mirror the `state` and `props` pattern from React,
 * while assuming that the output is an object that can be shallow compared
 * to check for equivalence.
 */
export default class Controller {
  constructor(props) {
    this.$props = this.$_addDefaultProps(props)
    this.$isDestroyed = false
    this.$listeners = []

    this.$runningActions = {}
    this.$runningPropsUpdate = false

    this.$transactionLevel = 0

    this.$actions = {}
    const actionTemplates = this.constructor.actions
    const actionKeys = Object.keys(actionTemplates)
    for (let key of actionKeys) {
      this.$actions[key] = this.$_doAction.bind(this, key, actionTemplates[key])
    }
    Object.freeze(this.$actions)
  }


  //
  // Internal API
  //

  get actions()   { return this.$actions }
  get props()       { return this.$props }

  setState(state) {
    if (this.$isDestroyed) {
      console.error('You cannot call `setState` on a controller instance that has been destroyed. Skipping setState.')
      return
    }

    this.$_doStateUpdate(state)
  }


  //
  // Overridable by subclass
  //

  doPropsDiffer(props) {
    return true
  }

  doesStateDiffer(state) {
    return true
  }

  output() {
    return {
      actions: this.actions,
      ...this.state,
    }
  }

  reconcile(a, b) {
    return false
  }

  //
  // Controller API
  //

  $initialize() {
    this.$_cachedOutput = this.output()
    if (!this.state) {
      this.state = {}
    }
    Object.freeze(this.state)
  }

  $set(props) {
    if (this.$isDestroyed) {
      console.error('You cannot call `set` on a controller instance that has been destroyed. Skipping.')
      return
    }

    this.$_doPropsUpdate(props)
  }

  $get() {
    return this.$_cachedOutput
  }

  $subscribe(change, transactionStart, transactionEnd) {
    const callbacks = { change, transactionStart, transactionEnd }
    this.$listeners.push(callbacks)
    return () => {
      const index = this.$listeners.indexOf(callbacks)
      if (index !== -1) {
        this.$listeners.splice(index, 1)
      }
    }
  }

  $destroy() {
    this.$listeners.length = 0
    this.$_cachedOutput = null
    this.$isDestroyed = true
  }

  //
  // Implementation details
  //

  $_doAction(key, fn, ...args) {
    if (this.$isDestroyed) {
      console.error('You cannot call actions on a controller instance that has been destroyed.')
      return
    }
    if (this.$runningActions[key]) {
      console.error(`Stubbornly refusing to start running action ${key} that has already run since the previous update. If you really want to recurse, do so outside of your actions.`)
      return
    }

    this.$_doIncreaseTransactionLevel()
    this.$runningActions[key] = true
    fn.apply(this, args)
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
    if (this.doPropsDiffer(propsWithDefaults)) {
      this.$_doIncreaseTransactionLevel()
      if (!this.$runningPropsUpdate && this.controllerWillReceiveProps) {
        this.$runningPropsUpdate = true
        this.controllerWillReceiveProps(propsWithDefaults)
        this.$runningPropsUpdate = false
      }
      this.$props = propsWithDefaults
      this.$_doDecreaseTransactionLevel()
    }
  }

  $_doStateUpdate(update) {
    const mergedState = { ...this.state, ...update }
    if (this.doesStateDiffer(mergedState)) {
      this.$_doIncreaseTransactionLevel()
      this.state = Object.freeze(mergedState)
      this.$_doDecreaseTransactionLevel()
    }
  }

  $_doIncreaseTransactionLevel() {
    if (++this.$transactionLevel == 1) {
      for (let { transactionStart } of this.$listeners) {
        transactionStart()
      }
    }
  }

  $_doDecreaseTransactionLevel() {
    if (--this.$transactionLevel == 0) {
      const newOutput = this.output()

      if (!this.reconcile(newOutput, this.$_cachedOutput)) {
        this.$_cachedOutput = newOutput
        for (let { change } of this.$listeners) {
          change(newOutput)
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
        transactionEnd(unlock)
      }
    }
  }
}
