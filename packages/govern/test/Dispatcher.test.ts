import { combine, createElement, instantiate, Component, Store, SFC } from '../src'
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

      publish() {
        return null
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
			  return this.state.child
      }

      publish() {
        return {
          doFetch: this.doFetch,
          doSetState: this.doSetState
        }
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
      store.getValue().doFetch()
    })

    // cause something to be emitted to subscription
    store.getValue().doSetState()

    expect(wasComponentDidInstantiateCalled).toBe(true)
    expect(wasActionCalled).toBe(true)
  })
})