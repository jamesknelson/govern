import React from 'react'
// import PropTypes from 'prop-types'
import { createController } from 'govern'


/**
 * A Component that manages to a controller with the given component,
 * and given props.
 *
 * The controller is then passed out via a render prop.
 */
export default class ControllerFactory extends React.Component {
  // static propTypes = {
  //   component: PropTypes.any,
  //   props: PropTypes.any,
  //   render: PropTypes.func.isRequired,
  // }

  componentWillMount() {
    // Create controllers within `componentWillMount` instead of in
    // `constructor`, as we can't rule out the possibility that
    // the controller will have some side effects on initialization.
    this.controller =
      this.props.component
        ? createController(this.props.component, this.props.props)
        : null
  }

  componentWillReceiveProps(nextProps) {
    const nextComponent = nextProps.component
    const nextComponentProps = nextProps.props
    if (nextComponent !== this.props.component) {
      if (this.controller) {
        this.controller.destroy()
      }
      this.controller =
        nextComponent
          ? createController(nextComponent, nextComponentProps)
          : null
    }
    else if (this.controller) {
      this.controller.set(nextComponentProps)
    }
  }

  componentDidCatch(error) {
    this.controller.destroy()
    throw error
  }

  componentWillUnmount() {
    this.controller.destroy()
  }

  render() {
    return React.createElement(this.props.render, {
      controller: this.controller
    })
  }
}