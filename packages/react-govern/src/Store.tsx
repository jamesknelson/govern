import * as React from 'react'
import { createElement, createObservable, Component, ElementType, GovernElement, GovernObservable, combine } from 'govern'

export function createStore<T>(
  element: GovernElement<T>,
  render?: (value: GovernObservable<BindingSnapshot<T>>) => React.ReactNode,
) {
  return Store.Element({ element, render })
}

export interface ObservableProps<T> {
  element: GovernElement<T>,

  children?: (store: GovernObservable<BindingSnapshot<T>>) => React.ReactNode,
  render?: (store: GovernObservable<BindingSnapshot<T>>) => React.ReactNode,
}

/**
 * Accepts an observable as a prop, and passes each of its values to the
 * component's children via a render function.
 * 
 * NOTE: this component should be generic on output type, but TSX doesn't
 * properly support generic components. In the meantime, if you want
 * typing, use the `createSubscribe` factory.
 * 
 * See https://github.com/Microsoft/TypeScript/issues/14729.
 */
export class Store<T=any> extends React.Component<ObservableProps<T>> {
  static Element<T>(props: ObservableProps<T>): React.ReactElement<ObservableProps<T>> {
    return React.createElement(Store, props) as any
  }

  observable: GovernObservable<BindingSnapshot<T>>
  isDispatching: boolean
  
  constructor(props: ObservableProps<T>) {
    super(props)
    this.observable = createObservable(createElement(Binding as ElementType<Binding<T>>, { initialElement: this.props.element }))
  }

  componentWillMount() {
    if (!this.props.element) {
      console.warn(`An "element" prop must be provided to <Observable> but "${this.props.element}" was received.`)
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: ObservableProps<any>) {
    if (!nextProps.element) {
      console.warn(`A "element" prop must be provided to <Observable> but "${this.props.element}" was received.`)
    }

    // As elements are immutable, we can skip a lot of updates by
    // checking if the `to` element/store has changed.
    if (nextProps.element !== this.props.element) {
      this.observable.getValue().changeElement(nextProps.element)
    }
  }

  componentDidCatch(error) {
    this.disposeStore()
  }

  componentWillUnmount() {
    this.disposeStore()
  }

  disposeStore() {
    if (this.observable) {
      this.observable.dispose()
      delete this.observable
    }
  }

  render() {
    let render = (this.props.children || this.props.render)!
    return render(this.observable)
  }
}


interface BindingProps<Value> {
  initialElement: GovernElement<Value, any>
}

interface BindingState<Value> {
  element: GovernElement<Value>
}

interface BindingSnapshot<Value> {
  snapshot: Value
  changeElement: (element: GovernElement<Value, any>) => void
}

class Binding<X> extends Component<BindingProps<X>, BindingState<X>, BindingSnapshot<X>> {
  constructor(props: BindingProps<X>) {
    super(props)
    this.state = {
      element: this.props.initialElement
    }
  }

  render() {
    return combine({
      snapshot: this.state.element,
      changeElement: this.changeElement,
    })
  }

  getPublishedValue() {
    this.subs
    return this.subs
  }

  shouldComponentPublish(prevProps, prevState, prevSubs) {
    return prevSubs.snapshot !== this.subs.snapshot
  }

  changeElement = (element: GovernElement<X, any>) => {
    this.setState({
      element,
    })
  }
}

