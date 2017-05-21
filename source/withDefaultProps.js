import React from 'react'
import hoistStatics from './hoistStatics'


export default function withDefaultProps(defaultProps) {
  return component => {
    const newComponent =
      component.prototype instanceof React.Component
        ? class extends component {}
        : props => component({ ...defaultProps, ...props })

    hoistStatics(component, newComponent)
    newComponent.displayName = component.displayName || component.name
    newComponent.defaultProps = {
      ...component.defaultProps,
      ...defaultProps,
    }
    return newComponent
  }
}