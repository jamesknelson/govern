import { StatefulComponent } from './GovernBaseClasses'
import { createController } from './GovernController'

const identity = x => x

export default function factory(componentGetter, propGetter=identity) {
  return class Factory extends StatefulComponent {
    constructor(props) {
      super(props)
      this.component = componentGetter(props)
      const componentProps = propGetter(props)
      this.state = {
        controller: createController(this.component, componentProps),
      }
    }

    componentWillReceiveProps(nextProps) {
      const nextComponent = componentGetter(nextProps)
      const nextComponentProps = propGetter(nextProps)
      if (nextComponent !== this.component) {
        if (this.component) {
          this.state.controller.destroy()
        }
        this.component = nextComponent
        this.setState({
          controller: nextComponent ? createController(nextComponent, nextComponentProps) : null
        })
      }
      else if (this.state.controller) {
        this.state.controller.set(nextComponentProps)
      }
    }

    componentWillBeDestroyed() {
      if (this.state.controller) {
        this.state.controller.destroy()
      }
    }

    output() {
      return this.state.controller
    }
  }
}