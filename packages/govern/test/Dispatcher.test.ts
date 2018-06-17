import { combine, createElement, createObservable, map, Component, GovernObservable, SFC } from '../src'
import { createCounter } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('Dipatcher', () => {
  it("actions dispatched within componentDidMount within a flush are called", () => {
    let wasActionCalled = false
    let wasComponentDidInstantiateCalled = false

    class DispatchComponent extends Component<{}> {
      constructor(props) {
        super(props)
      }

      render() {
        return null
      }

      componentDidMount() {
        wasComponentDidInstantiateCalled = true
			  this.dispatch(() => {
          wasActionCalled = true
        })
			}
    }

		class TestComponent extends Component<{}, any> {
      state = {
        child: undefined,
        dummy: false,
      }

			render() {
        return map(
          this.state.child || null,
          () => ({
            doFetch: this.doFetch,
            doSetState: this.doSetState
          })
        )
      }

      doSetState = () => {
        this.setState({
          dummy: true
        })
      }
		
			doFetch = () => {
        this.dispatch(() => {
          this.setState({
            child: createElement(DispatchComponent)
          })
        })
      }
    }
    
    let store = createObservable(createElement(TestComponent, null))

    // `subscribe` listeners are called on flush
    let subscription = store.subscribe(() => {
      subscription.unsubscribe()
      store.getValue().doFetch()
    })

    // cause something to be emitted to subscription
    store.getValue().doSetState()

    expect(wasComponentDidInstantiateCalled).toBe(true)
    expect(wasActionCalled).toBe(true)
  })
})