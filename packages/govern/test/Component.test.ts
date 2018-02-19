import { flatMap, combine, createElement, instantiate, Component, Outlet, SFC } from '../src'
import { createCounter } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('Component', () => {
  it("actions with setState throw an error when not in a transaction", () => {
    class TestComponent extends Component<{}> {
      publish() {
        return {
          action: () => {
            this.setState({})
          }
        }
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    expect(() => {
      outlet.getValue().action()
    }).toThrow()
  })

	it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}> {
			subscribe() {
			  return combine({
				  a: 1
			  })
      }

      publish() {
        return this.subs
      }
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.subs
			}
		
			componentDidUpdate(nextProps, nextState, nextComp) {
			  didCallDidUpdate = true
			}
    }
    
    let outlet = instantiate(createElement(TestComponent, null))
    expect(didCallDidUpdate).toBe(false)
    expect(calledDidInstantiateWith).toEqual({ a: 1 })
  })

  it("componentDidUpdate is called once after an update with no side effects", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			subscribe() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.subs
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
			  didUpdateCallCount += 1
			}
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(outlet)
    harness.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(1)
    expect(harness.value).toEqual({ a: 1 })
  })
  
  it("setState within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			subscribe() {
        return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.subs
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
        if (this.state.a === 1) {
          this.setState({ a: 2 })
        }
			  didUpdateCallCount += 1
			}
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(outlet)
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({ a: 2 })
    expect(didUpdateCallCount).toBe(2)
  })

  it("children emitting values within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0
    let counter = createCounter()

		class TestComponent extends Component<{ updated }, { a }> {
      get subs() {
        return this.getTypedSubs(this)
      }

      subscribe() {
			  return combine({
          a: counter,
        })
      }
      
      publish() {
        return {
          a: this.subs.a.count
        }
      }
		
			componentDidUpdate(prevProps, prevState, prevSubs) {
        didUpdateCallCount += 1
        if (this.subs.a.count === 0) {
          this.subs.a.increase()
        }
			}
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    expect(didUpdateCallCount).toBe(0)
    let harness = createTestHarness(outlet)
    harness.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(2)
    expect(harness.value).toEqual({ a: 1 })
  })

  it("setState within componentWillReceiveProps is reflected within the output", () => {
    class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			componentWillReceiveProps(nextProps) {
        this.setState({ a: 2 })
			}

			subscribe() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.subs
      }
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    let updateCount = 0
    let harness = createTestHarness(outlet, () => {
      updateCount++
    })
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({ a: 2 })
  })

  it("shouldComponentPublish can prevent updates", () => {
    class TestComponent extends Component<{ updated }> {
      shouldComponentPublish() {
        return false
      }
      
      publish() {
        return null
      }
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    let updateCount = 0
    let harness = createTestHarness(outlet, () => {
      updateCount++
    })
    expect(updateCount).toBe(1)
    harness.setProps({ updated: true })
    expect(updateCount).toBe(1)
  })

  it("shouldComponentPublish receives old state and props", () => {
    let state, props
    let nextState, nextProps

    class TestComponent extends Component<{ updated }> {
      state = { x: 1 }

      componentWillReceiveProps(nextProps) {
        this.setState({
          x: 2
        })
      }

      shouldComponentPublish(prevProps, prevState) {
        state = prevState
        props = prevProps
        nextState = this.state
        nextProps = this.props
        return false
      }
      
      publish() {
        return null
      }
    }
    
    let outlet = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(outlet)
    harness.setProps({ updated: true })
    expect(state).toEqual({ x: 1 })
    expect(props).toEqual({ updated: false })
    expect(nextState).toEqual({ x: 2 })
    expect(nextProps).toEqual({ updated: true })
  })

  it("child components with shouldComponentPublish: false still appear in the parent after setting parent props", () => {
    class TestChildComponent extends Component {
      shouldComponentPublish(prevProps, prevState) {
        return false
      }
      
      publish() {
        return "hello"
      }
    }

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          test: createElement(TestChildComponent)
        })
      }

      publish() {
        return {
          child: this.subs,
          updated: this.props.updated,
        }
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({
      updated: true,
      child: {
        test: "hello"
      },
    })
  })

  it(`removing a property of a <combine /> connected child removes its value from subs`, () => {
    class Constant extends Component {
      publish() {
        return 'a'
      }
    }
    let observable = instantiate(createElement(Constant))

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        let children = { a: observable, b: observable }
        if (this.props.updated) delete children.b
        return combine(children)
      }
      publish() {
        return this.subs
      }
    }
    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(harness.value).toEqual({ a: 'a', b: 'a' })
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({ a: 'a' })
  })

  it("changing a child from an object with numeric keys to an array recreates the children", () => {
    let childConstructorCount = 0
    class Child extends Component {
      constructor(props) {
        super(props)
        childConstructorCount++
      }
      publish() {
        return "test"
      }
    }
    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return (
          this.props.updated
            ? [createElement(Child)]
            : {'0': createElement(Child)} as any
        )
      }
      publish() {
        return null
      }
    }
    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(childConstructorCount).toEqual(1)
    harness.setProps({ updated: true })
    expect(childConstructorCount).toEqual(2)
  })

  it("events can be received from combined <subscribe /> elements when emitted during `componentWillReceiveProps` ", () => {
    let counterOutlet = createCounter()

    class TestComponent extends Component<{ updated }> {
      componentWillReceiveProps() {
        this.subs.inner.increase()
      }

      subscribe() {
        return combine({
          inner: counterOutlet
        })
      }

      publish() {
        return this.subs.inner.count
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(harness.value).toEqual(0)
    harness.setProps({ updated: true })
    expect(harness.value).toEqual(1)
  })

  it("shouldComponentPublish receives old subs", () => {
    let counterOutlet = createCounter()
    let shouldComponentPublishValue

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          inner: counterOutlet
        })
      }

      shouldComponentPublish(prevProps, prevState, prevSubs) {
        shouldComponentPublishValue = prevSubs.inner !== this.subs.inner
      }

      publish() {
        return this.subs
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    harness.dispatch(() => {
      harness.value.inner.increase()
    })
    expect(shouldComponentPublishValue).toEqual(true)
  })

  it("events can be received from combined outlets in the same transaction as a setState", () => {
    let counterOutlet = createCounter()

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          inner: counterOutlet
        })
      }

      publish() {
        return {
          child: this.subs.inner.count,
          update: () => {
            this.setState({})
            this.subs.inner.increase()
          },
        }
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    harness.dispatch(() => {
      harness.value.update()
    })
    expect(harness.value.child).toEqual(1)
  })

  it("supports getDerivedStateFromProps", () => {
    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      static getDerivedStateFromProps(props: { updated }, prevState) {
        return props.updated ? { hello: 'world' } : {}
      }

      publish() {
        return this.state.hello
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(harness.value).toBe(undefined)
    harness.setProps({ updated: true })
    expect(harness.value).toBe('world')
  })

  it("can subscribe to nested outlets", () => {
    let counterOutlet = createCounter()

    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      subscribe() {
        return {
          outer: {
            inner: counterOutlet
          }
        } as any
      }

      publish() {
        return this.subs.outer.inner
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(harness.value.count).toBe(0)
    harness.dispatch(() => {
      harness.value.increase()
    })
    expect(harness.value.count).toBe(1)
  })

  it("can subscribe to arrays of outlets", () => {
    let counter1Outlet = createCounter()
    let counter2Outlet = createCounter()

    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      subscribe() {
        return [
          counter1Outlet,
          counter2Outlet,
        ] as any
      }

      publish() {
        return this.subs
      }
    }

    let outlet = instantiate(createElement(TestComponent))
    let harness = createTestHarness(outlet)
    expect(harness.value[0].count).toBe(0)
    harness.dispatch(() => {
      harness.value[0].increase()
    })
    expect(harness.value[0].count).toBe(1)
    expect(harness.value[1].count).toBe(0)
  })
})
