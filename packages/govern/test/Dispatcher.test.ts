import { combine, createElement, instantiate, map, Component, Store, SFC } from '../src'
import { createCounter } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('Dipatcher', () => {
  it("actions dispatched within componentDidInstantiate within a flush are called", () => {
    let wasActionCalled = false
    let wasComponentDidInstantiateCalled = false

    class DispatchComponent extends Component<{}> {
      constructor(props) {
        super(props)
      }

      subscribe() {
        return null
      }

      publish() {
        return this.subs
      }

      componentDidInstantiate() {
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

			subscribe() {
        return map(
          this.state.child || null,
          () => ({
            doFetch: this.doFetch,
            doSetState: this.doSetState
          })
        )
      }

      publish() {
        return this.subs
      }

      doSetState = () => {
        this.setState({
          dummy: true
        })
      }
		
			doFetch = () => {
        this.setState({
          child: createElement(DispatchComponent)
        })
      }
    }
    
    let store = instantiate(createElement(TestComponent, null))

    // `subscribe` listeners are called on flush
    let subscription = store.subscribe(() => {
      subscription.unsubscribe()
      store.UNSAFE_dispatch(() => {
        store.getValue().doFetch()
      })
    })

    // cause something to be emitted to subscription
    store.getValue().doSetState()

    expect(wasComponentDidInstantiateCalled).toBe(true)
    expect(wasActionCalled).toBe(true)
  })
})