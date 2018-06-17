import * as React from 'react'
import { combine, createElement, createObservable, Component, GovernElement, GovernObservable, Subscription, ElementType } from 'govern'

const PriorityContext = (React as any).createContext(1)

export function createSubscribe<T>(
  to: GovernElement<T> | GovernObservable<T>,
  render?: (value: T, dispatch: Function) => React.ReactNode,
) {
  return Subscribe.Element({ to, render })
}

export interface SubscribeProps<T> {
  to: GovernElement<T> | GovernObservable<T>,

  children?: (value: T, dispatch: Function) => React.ReactNode,
  render?: (value: T, dispatch: Function) => React.ReactNode,
}

export namespace Subscribe {
  export type Props<T> = SubscribeProps<T>
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
export class Subscribe<T> extends React.Component<SubscribeProps<T>> {
  /**
   * A factory to create a `<Subscribe to>` React element, with typing.
   * @param store The store to subscribe to
   * @param children A function to render each of the store's values.
   */
  static Element<T>(props: SubscribeProps<T>): React.ReactElement<SubscribeProps<T>> {
    return React.createElement(Subscribe, props) as any
  }

  render() {
    return <PriorityContext.Consumer children={this.renderWithPriority} />
  }

  renderWithPriority = (priority) => {
    return <InnerSubscribe {...this.props} priority={priority} />
  }
}


interface InnerSubscribeProps<T> extends SubscribeProps<T> {
  priority: number
}

interface InnerSubscribeState<T> {
  dispatch: (fn: () => void) => void,
  snapshot: T,
  dummy?: any
}

export class InnerSubscribe<T> extends React.Component<InnerSubscribeProps<T>, InnerSubscribeState<T>> {
  observable: GovernObservable<BindingSnapshot<T>>
  subscription: Subscription
  isDispatching: boolean
  isAwaitingRenderFromProps: boolean
  isAwaitingRenderFromFlush: boolean

  constructor(props: InnerSubscribeProps<T>) {
    super(props)
    this.state = {} as any
    this.isDispatching = false

    if (!this.props.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    this.observable = createObservable(Binding.Element({ initialElement: this.props.to }))

    this.isAwaitingRenderFromFlush = true
    this.isAwaitingRenderFromProps = false
    this.state = {
      snapshot: this.observable.getValue().snapshot,
      dispatch: this.observable.waitUntilNotFlushing,
    }

    // Create subsription within `componentWillMount` instead of in
    // `constructor`, as it is possible for components to have side effects
    // on initial subscription (as the first `componentDidFlush` is held
    // until then, and it can cause `setState`.
    this.subscription = this.observable.subscribe(
      this.handleChange,
      this.receiveError,
      undefined,
      this.handleStartDispatch,
      this.handleEndDispatch,
      String(this.props.priority)
    )
  }

  UNSAFE_componentWillReceiveProps(nextProps: SubscribeProps<any>) {
    if (!nextProps.to) {
      console.warn(`A "to" prop must be provided to <Subscribe> but "${this.props.to}" was received.`)
    }

    // If no flush is received during dispatch, we'll want to re-render
    // manually when it completes.
    if (this.isDispatching) {
      this.isAwaitingRenderFromProps = true
    }

    // As elements are immutable, we can skip a lot of updates by
    // checking if the `to` element/store has changed.
    if (nextProps.to !== this.props.to) {
      this.observable.getValue().changeElement(nextProps.to)
    }
  }

  componentDidCatch(error) {
    this.cleanup()
  }

  componentWillUnmount() {
    this.cleanup()
  }

  receiveError = (error) => {
    // Grab errors from the store, and throw them so a higher level React
    // component can handle it with componentDidCatch.
    throw error
  }

  cleanup() {
    if (this.observable) {
      this.subscription.unsubscribe()
      this.observable.dispose()
      delete this.subscription
      delete this.observable
    }
  }

  shouldComponentUpdate() {
    return !this.isDispatching || this.isAwaitingRenderFromFlush
  }

  render() {
    this.isAwaitingRenderFromFlush = false
    this.isAwaitingRenderFromProps = false
    let children = this.props.children! || this.props.render!
    return children(this.state.snapshot, this.state.dispatch)
  }

  handleChange = (snapshot: BindingSnapshot<T>, dispatch) => {
    this.isAwaitingRenderFromFlush = true
    this.isAwaitingRenderFromProps = false
    this.setState({
      snapshot: snapshot.snapshot,
      dispatch
    })
  }

  handleStartDispatch = () => {
    this.isDispatching = true
  }

  handleEndDispatch = () => {
    this.isDispatching = false

    if (this.isAwaitingRenderFromProps) {
      // Now that `isDispatching` is false, `shouldComponentUpdate` will return
      // true, so we can flush through our changes by setting a dummy object.
      this.setState({ dummy: {} })
    }
  }
}


interface BindingProps<Value> {
  initialElement: GovernElement<Value, any> | GovernObservable<Value>
}

interface BindingState<Value> {
  element: GovernElement<Value, any> | GovernObservable<Value>
}

interface BindingSnapshot<Value> {
  snapshot: Value
  changeElement: (element: GovernElement<Value, any> | GovernObservable<Value>) => void
}

class Binding<T> extends Component<BindingProps<T>, BindingState<T>, BindingSnapshot<T>> {
  static Element<T>(props: BindingProps<T>) {
    return createElement(Binding as ElementType<Binding<T>>, props)
  }

  constructor(props: BindingProps<T>) {
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

  shouldComponentPublish(prevProps, prevState, prevSubs) {
    return prevSubs.snapshot !== this.subs.snapshot
  }

  changeElement = (element: GovernElement<T, any> | GovernObservable<T>) => {
    this.setState({
      element,
    })
  }
}

