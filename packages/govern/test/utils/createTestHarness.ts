import { Component, ElementType, GovernElement, GovernObservable, createElement, createObservable, map } from '../../src'

interface HarnessProps<Value> {
  element: GovernElement<Value, any>
}

interface HarnessSnapshot<Value> {
  value: Value
  changeElement: (element: GovernElement<Value, any>) => void
  dispatch: (fn: () => void) => void
}

class Harness<Value> extends Component<HarnessProps<Value>, any, HarnessSnapshot<Value>> {
  state = {
    element: this.props.element
  }

  constructor(props: HarnessProps<Value>) {
    super(props)

    this.dispatch = this.dispatch.bind(this)
  }

  render() {
    return map(
      this.state.element,
      value => ({
        value,
        changeElement: this.changeElement,
        dispatch: this.dispatch,
      })
    )
  }

  shouldComponentPublish(prevProps, prevState, prevSubs) {
    return prevSubs.value !== this.subs.value
  }

  changeElement = (element: GovernElement<Value, any>) => {
    this.setState({
      element,
    })
  }
}

export function createTestHarness<Value>(element: GovernElement<Value, any>, onChange?: () => void): { dispatch: Function, value: Value, changeElement: Function } {
  let observable =
    createObservable(
      createElement(Harness as ElementType<Harness<Value>>, {
        element,
      })
    )
  
  let harness = observable.getValue()

  observable.subscribe((value, dispatch) => {
      harness.value = value.value
      if (onChange) {
        onChange()
      }
  })
  
  return harness
}