import React, { Component } from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'
import instantiateController from './instantiateController'


/**
 * A HoC to create and destroy controllers of the supplied type when
 * necessary, and then destroy them when no longer needed.
 *
 * In the case a single function is provided, the created controller
 * will be placed on the `controller` prop.
 */
export default function instantiateDefaultControllers(controllerClasses) {
  const isSingleton = typeof controllerClasses == 'function'

  if (isSingleton) {
    controllerClasses = { controller: controllerClasses }
  }

  const keys = Object.keys(controllerClasses)
  if (keys.length === 0) {
    console.warning("instantiateDefaultControllers: called without any classes")
  }

  function createMissingControllers(props) {
    const created = {}

    for (let key of keys) {
      if (props[key] === undefined) {
        const ControllerClass = controllerClasses[key]
        created[key] = instantiateController(ControllerClass, props)
      }
    }

    return created
  }

  return WrappedComponent => {
    class InstantiateDefaultControllers extends Component {
      constructor(props) {
        super(props)

        this.state = {
          defaults: createMissingControllers(props),
        }
      }

      componentWillReceiveProps(nextProps) {
        for (let key of Object.keys(this.state.defaults)) {
          if (nextProps[key] !== undefined) {
            this.state.defaults[key].destroy()
            delete this.state.defaults[key]
          }
        }

        const merged = { ...nextProps, ...this.state.defaults }
        this.setState({
          defaults: Object.assign(this.state.defaults, createMissingControllers(merged))
        })
      }

      componentWillUnmount() {
        for (let key of Object.keys(this.state.defaults)) {
          this.state.defaults[key].destroy()
          delete this.state.defaults[key]
        }
      }

      render() {
        return React.createElement(WrappedComponent, {
            ...this.props,
            ...this.state.defaults
        })
      }
    }

    hoistNonReactStatics(InstantiateDefaultControllers, WrappedComponent)

    return InstantiateDefaultControllers
  }
}
