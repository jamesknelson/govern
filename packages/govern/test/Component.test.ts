import { combine, createElement, instantiate, Component, Store, SFC, constant } from '../src'
import { createCounter } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('Component', () => {
  it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}> {
			render() {
			  return combine({
				  a: 1
			  })
      }
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.subs
			}
		
			componentDidUpdate(nextProps, nextState, nextComp) {
			  didCallDidUpdate = true
			}
    }
    
    let store = instantiate(createElement(TestComponent, null))
    expect(didCallDidUpdate).toBe(false)
    expect(calledDidInstantiateWith).toEqual({ a: 1 })
  })

  it("componentDidUpdate is called once after an update with no side effects", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			render() {
			  return combine({
				  a: this.state.a
			  })
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
			  didUpdateCallCount += 1
			}
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(store)
    harness.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(1)
    expect(harness.value).toEqual({ a: 1 })
  })
  
  it("setState within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			render() {
        return combine({
				  a: this.state.a
			  })
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
        if (this.state.a === 1) {
          this.setState({ a: 2 })
        }
			  didUpdateCallCount += 1
			}
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(store)
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({ a: 2 })
    expect(didUpdateCallCount).toBe(2)
  })

  it("children emitting values within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0
    let counter = createCounter()

		class TestComponent extends Component<{ updated }, { a }> {
      render() {
			  return combine({
          a: counter,
        })
      }
		
			componentDidUpdate(prevProps, prevState, prevSubs) {
        didUpdateCallCount += 1
        if (this.subs.a.count === 0) {
          this.subs.a.increase()
        }
			}
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    expect(didUpdateCallCount).toBe(0)
    let harness = createTestHarness(store)
    harness.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(2)
    expect(harness.value.a.count).toEqual(1)
  })

  it("setState within UNSAFE_componentWillReceiveProps is reflected within the output", () => {
    class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			UNSAFE_componentWillReceiveProps(nextProps) {
        this.setState({ a: 2 })
			}

			render() {
			  return combine({
				  a: this.state.a
			  })
      }
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    let updateCount = 0
    let harness = createTestHarness(store, () => {
      updateCount++
    })
    harness.setProps({ updated: true })
    expect(harness.value).toEqual({ a: 2 })
  })

  it("shouldComponentUpdate can prevent updates", () => {
    class TestComponent extends Component<{ updated }> {
      shouldComponentUpdate() {
        return false
      }

      render() {
        return null
      }
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    let updateCount = 0
    let harness = createTestHarness(store, () => {
      updateCount++
    })
    expect(updateCount).toBe(0)
    harness.setProps({ updated: true })
    expect(updateCount).toBe(0)
  })

  it("shouldComponentUpdate receives new state and props", () => {
    let state, props
    let nextState, nextProps

    class TestComponent extends Component<{ updated }> {
      state = { x: 1 }

      UNSAFE_componentWillReceiveProps(nextProps) {
        this.setState({
          x: 2
        })
      }

      shouldComponentUpdate(_nextProps, _nextState) {
        state = this.state
        props = this.props
        nextState = _nextState
        nextProps = _nextProps
        return false
      }

      render() {
        return null
      }
    }
    
    let store = instantiate(createElement(TestComponent, { updated: false }))
    let harness = createTestHarness(store)
    harness.setProps({ updated: true })
    expect(state).toEqual({ x: 1 })
    expect(props).toEqual({ updated: false })
    expect(nextState).toEqual({ x: 2 })
    expect(nextProps).toEqual({ updated: true })
  })

  it("child components with shouldComponentUpdate: false still appear in the parent after setting parent props", () => {
    class TestChildComponent extends Component {
      shouldComponentUpdate(prevProps, prevState) {
        return false
      }

      render() {
        return constant("hello")
      }
    }

    class TestComponent extends Component<{ updated }> {
      render() {
        return combine({
          child: combine({
            test: createElement(TestChildComponent)
          }),
          updated: this.props.updated,
        })
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
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
      render() {
        return constant('a')
      }
    }
    let observable = instantiate(createElement(Constant))

    class TestComponent extends Component<{ updated }> {
      render() {
        let children = { a: observable, b: observable }
        if (this.props.updated) delete children.b
        return combine(children)
      }
    }
    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
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
      render() {
        return constant("test")
      }
    }
    class TestComponent extends Component<{ updated }> {
      render() {
        return (
          this.props.updated
            ? [createElement(Child)]
            : {'0': createElement(Child)} as any
        )
      }
    }
    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    expect(childConstructorCount).toEqual(1)
    harness.setProps({ updated: true })
    expect(childConstructorCount).toEqual(2)
  })

  it("events can be received from combined <subscribe /> elements when emitted during `UNSAFE_componentWillReceiveProps` ", () => {
    let counterStore = createCounter()

    class TestComponent extends Component<{ updated }> {
      UNSAFE_componentWillReceiveProps() {
        this.subs.inner.increase()
      }

      render() {
        return combine({
          inner: counterStore
        })
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    expect(harness.value.inner.count).toEqual(0)
    harness.setProps({ updated: true })
    expect(harness.value.inner.count).toEqual(1)
  })

  it("events can be received from combined stores in the same transaction as a setState", () => {
    let counterStore = createCounter()

    class TestComponent extends Component<{ updated }> {
      render() {
        return combine({
          child: counterStore,
          update: () => {
            this.setState({})
            this.subs.child.increase()
          }
        })
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    harness.dispatch(() => {
      harness.value.update()
    })
    expect(harness.value.child.count).toEqual(1)
  })

  it("calls getDerivedStateFromProps on instantiation", () => {
    class TestComponent extends Component<{ hello }, any> {
      state = {} as any

      static getDerivedStateFromProps(props: { hello }, prevState) {
        return props.hello ? { hello: 'world' } : {}
      }

      render() {
        return constant(this.state.hello)
      }
    }

    let store = instantiate(createElement(TestComponent, { hello: 'derive' }))
    let harness = createTestHarness(store)
    expect(harness.value).toBe('world')
  })

  it("calls getDerivedStateFromProps on update", () => {
    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      static getDerivedStateFromProps(props: { updated }, prevState) {
        return props.updated ? { hello: 'world' } : {}
      }

      render() {
        return constant(this.state.hello)
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    expect(harness.value).toBe(undefined)
    harness.setProps({ updated: true })
    expect(harness.value).toBe('world')
  })

  it("can subscribe to nested stores", () => {
    let counterStore = createCounter()

    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      render() {
        return {
          outer: {
            inner: counterStore
          }
        } as any
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    expect(harness.value.outer.inner.count).toBe(0)
    harness.dispatch(() => {
      harness.value.outer.inner.increase()
    })
    expect(harness.value.outer.inner.count).toBe(1)
  })

  it("can subscribe to arrays of stores", () => {
    let counter1Store = createCounter()
    let counter2Store = createCounter()

    class TestComponent extends Component<{ updated }, any> {
      state = {} as any

      render() {
        return [
          counter1Store,
          counter2Store,
        ] as any
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)
    expect(harness.value[0].count).toBe(0)
    harness.dispatch(() => {
      harness.value[0].increase()
    })
    expect(harness.value[0].count).toBe(1)
    expect(harness.value[1].count).toBe(0)
  })

  // it("can call actions on parents during disposal", () => {

  // })
})
