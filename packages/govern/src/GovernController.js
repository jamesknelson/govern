/**
 * A GovernController contains the interface used to access a single instance
 * of a GovernComponent:
 *
 * - `changeProps` will change its input props, calling
 *   `componentWillReceiveProps` and `output`
 * - `destroy` will clean up the controller after calling
 *   `componentWillBeDestroyed`.
 */


import { StatefulComponent } from './GovernBaseClasses'
import { createParallelComponent } from './GovernParallelComponent'
import { createSeriesComponent } from './GovernSeriesComponent'


const flag = Symbol('govern-controller-flag')


export function createController(type, props={}) {
  const propsWithDefaults = Object.assign({}, props)
  const defaultProps = type.defaultProps
  if (defaultProps) {
    for (let key of Object.keys(defaultProps)) {
      if (props[key] === undefined) {
        propsWithDefaults[key] = defaultProps[key]
      }
    }
  }

  const ctr = combineComponents(type)
  const instance = new ctr(propsWithDefaults)
  const controller = instance.createGovernController()

  Object.defineProperty(controller, flag, { value: true })

  return Object.freeze(controller)
}


export function isGovernController(x) {
  return x && x[flag]
}


function combineComponents(structure) {
  if (typeof structure === 'function') {
    if (structure.prototype && typeof structure.prototype.createGovernController === 'function') {
      return structure
    }
    else {
      return class extends StatefulComponent {
        output() { return structure(this.props) }
      }
    }
  }
  else if (Array.isArray(structure)) {
    return createSeriesComponent(...structure.map(combineComponents))
  }
  else {
    const mapped = {}
    const keys = Object.keys(structure)
    for (let key of keys) {
      mapped[key] = combineComponents(structure[key])
    }
    return createParallelComponent(mapped)
  }
}