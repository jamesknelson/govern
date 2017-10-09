/**
 * A GovernorController allows you to make changes to a governor:
 *
 * - `set` will change its input props, calling `governorWillReceiveProps`
 *   and `output`
 * - `destroy` will clean up the governor after calling
 *   `governorWillBeDestroyed`.
 *
 * GovernorController objects differ from GovernorOutlets in that they allow
 * you to cause changes that the object cannot ignore.
 */


import Governor from './Governor'
import ParallelGovernor, { createParallelGovernor } from './ParallelGovernor'
import SeriesGovernor, { createSeriesGovernor } from './SeriesGovernor'


const flag = Symbol('governor-controller-flag')


export function createGovernorController(type, props={}) {
  const propsWithDefaults = Object.assign({}, props)
  const defaultProps = type.defaultProps
  if (defaultProps) {
    for (let key of Object.keys(defaultProps)) {
      if (props[key] === undefined) {
        propsWithDefaults[key] = defaultProps[key]
      }
    }
  }

  const ctr = combineGovernors(type)
  const instance = new ctr(propsWithDefaults)

  instance.$initialize()

  const governor = {
    // GovernorOutlet
    get: instance.$get.bind(instance),
    subscribe: instance.$subscribe.bind(instance),

    // GovernorController
    set: instance.$set.bind(instance),
    destroy: instance.$destroy.bind(instance),
  }

  Object.defineProperty(governor, flag, { value: true })

  return Object.freeze(governor)
}


export function isGovernorController(x) {
  return x && x[flag]
}


function combineGovernors(structure) {
  if (structure.prototype instanceof Governor || structure.prototype instanceof SeriesGovernor || structure.prototype instanceof ParallelGovernor) {
    return structure
  }
  else if (typeof structure === 'function') {
    return class extends Governor {
      output() { return structure(this.props) }
    }
  }
  else if (Array.isArray(structure)) {
    return createSeriesGovernor(...structure.map(combineGovernors))
  }
  else {
    const mapped = {}
    const keys = Object.keys(structure)
    for (let key of keys) {
      mapped[key] = combineGovernors(structure[key])
    }
    return createParallelGovernor(mapped)
  }
}