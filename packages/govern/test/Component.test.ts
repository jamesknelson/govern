import * as Observable from 'zen-observable'
import { Outlet, OutletSubject } from 'outlets'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createCounter } from './utils/createCounter'

describe('Component', () => {
	it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}> {
			connectChild() {
			  return combine({
				  a: 1
			  })
      }

      publish() {
        return this.child
      }
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.child
			}
		
			componentDidUpdate(nextProps, nextState, nextComp) {
			  didCallDidUpdate = true
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, null))
    expect(didCallDidUpdate).toBe(false)
    expect(calledDidInstantiateWith).toEqual({ a: 1 })
  })

  it("componentDidUpdate is called once after an update with no side effects", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			connectChild() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.child
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
			  didUpdateCallCount += 1
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(1)
    expect(governor.getValue()).toEqual({ a: 1 })
  })
  
  it("setState within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			connectChild() {
        return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.child
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
        if (this.state.a === 1) {
          this.setState({ a: 2 })
        }
			  didUpdateCallCount += 1
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(2)
    expect(governor.getValue()).toEqual({ a: 2 })
  })

  it("children emitting values within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0
    let counter = createCounter()

		class TestComponent extends Component<{ updated }, { a }> {
      get child() {
        return this.getTypedChild(this)
      }

      connectChild() {
			  return combine({
          a: subscribe(counter)
        })
      }
      
      publish() {
        return {
          a: this.child.a.count
        }
      }
		
			componentDidUpdate(prevProps, prevState, prevSubs) {
        didUpdateCallCount += 1
        if (this.child.a.count === 0) {
          counter.getValue().increase()
        }
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    expect(didUpdateCallCount).toBe(0)
    governor.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(2)
    expect(governor.getValue()).toEqual({ a: 1 })
  })

  it("setState within componentWillReceiveProps is reflected within the output", () => {
    class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			componentWillReceiveProps(nextProps) {
        this.setState({ a: 2 })
			}

			connectChild() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      publish() {
        return this.child
      }
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    let latest
    let updateCount = 0
    governor.subscribe(value => {
      latest = value
      updateCount++
    })
    governor.setProps({ updated: true })
    expect(latest).toEqual({ a: 2 })
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
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    let latest
    let updateCount = 0
    governor.subscribe(value => {
      latest = value
      updateCount++
    })
    expect(updateCount).toBe(1)
    governor.setProps({ updated: true })
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
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    let latest
    let updateCount = 0
    governor.subscribe(value => {
      latest = value
      updateCount++
    })
    governor.setProps({ updated: true })
    expect(state).toEqual({ x: 1 })
    expect(props).toEqual({ updated: false })
    expect(nextState).toEqual({ x: 2 })
    expect(nextProps).toEqual({ updated: true })
  })

  it("throws if 'subscribe' returns a non-node object", () => {
    expect(() => {
      class TestComponent extends Component<{}> {
        connectChild() {
          return {
            a: 1
          }
        }
        
        publish() {
          return this.child
        }
      }

      createGovernor(createElement(TestComponent))
    }).toThrow()
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
      connectChild() {
        return combine({
          test: createElement(TestChildComponent)
        })
      }

      publish() {
        return {
          child: this.child,
          updated: this.props.updated,
        }
      }
    }

    let governor = createGovernor(createElement(TestComponent))
    let latest
    governor.subscribe(next => {
      latest = next
    })
    governor.setProps({ updated: true })
    expect(latest).toEqual({
      updated: true,
      child: {
        test: "hello"
      },
    })
  })

  it(`removing a property of a <combine /> connected child removes its value from subs`, () => {
    let observable = Observable.from('a')

    class TestComponent extends Component<{ updated }> {
      connectChild() {
        let children = { a: subscribe(observable), b: subscribe(observable) }
        if (this.props.updated) delete children.b
        return combine(children)
      }
      publish() {
        return this.child
      }
    }
    let governor = createGovernor(createElement(TestComponent))
    let latest
    governor.subscribe(next => { latest = next })
    expect(latest).toEqual({ a: 'a', b: 'a' })
    governor.setProps({ updated: true })
    expect(latest).toEqual({ a: 'a' })
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
      connectChild() {
        return combine(
          this.props.updated
            ? [createElement(Child)]
            : {'0': createElement(Child)} as any
        )
      }
      publish() {
        return null
      }
    }
    let governor = createGovernor(createElement(TestComponent))
    expect(childConstructorCount).toEqual(1)
    governor.setProps({ updated: true })
    expect(childConstructorCount).toEqual(2)
  })

  it("events can be received from combined <subscribe /> elements when emitted during `componentWillReceiveProps` ", () => {
    let subject = new OutletSubject(1)
    let outlet = new Outlet(subject)

    class TestComponent extends Component<{ updated }> {
      componentWillReceiveProps() {
        subject.next(2)
      }

      connectChild() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      publish() {
        return this.child
      }
    }

    let governor = createGovernor(createElement(TestComponent))
    let latest
    governor.subscribe(next => {
      latest = next
    })
    expect(latest).toEqual({
      inner: 1
    })
    governor.setProps({ updated: true })
    expect(latest).toEqual({
      inner: 2
    })
  })

  it("shouldComponentPublish receives old subs", () => {
    let subject = new OutletSubject(1)
    let outlet = new Outlet(subject)
    let shouldComponentPublishValue

    class TestComponent extends Component<{ updated }> {
      connectChild() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      shouldComponentPublish(prevProps, prevState, prevSubs) {
        shouldComponentPublishValue = prevSubs.inner !== this.child.inner
      }

      publish() {
        return this.child
      }
    }

    let governor = createGovernor(createElement(TestComponent))
    subject.next(2)
    expect(shouldComponentPublishValue).toEqual(true)
  })

  it("events can be received from combined <subscribe /> elements in the same transaction as a setState", () => {
    let subject = new OutletSubject(1)
    let outlet = new Outlet(subject)

    class TestComponent extends Component<{ updated }> {
      connectChild() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      publish() {
        return {
          child: this.child,
          update: () => {
            subject.transactionStart()
            this.setState({})
            subject.next(2)
            subject.transactionEnd()
          },
        }
      }
    }

    let governor = createGovernor(createElement(TestComponent))
    let latest
    governor.subscribe(next => {
      latest = next
    })
    governor.getValue().update()
    expect(latest.child).toEqual({
      inner: 2
    })
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

    let governor = createGovernor(createElement(TestComponent))
    expect(governor.getValue()).toBe(undefined)
    governor.setProps({ updated: true })
    expect(governor.getValue()).toBe('world')
  })
})
