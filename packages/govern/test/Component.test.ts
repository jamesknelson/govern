import * as Observable from 'zen-observable'
import { Outlet, OutletSubject } from 'outlets'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createCounter } from './utils/createCounter'

describe('Component', () => {
	it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}> {
			subscribe() {
			  return combine({
				  a: 1
			  })
      }

      getValue() {
        return this.subs
      }
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.subs
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

			subscribe() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      getValue() {
        return this.subs
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
			  didUpdateCallCount += 1
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    governor.flush()
    expect(didUpdateCallCount).toBe(1)
    expect(governor.getValue()).toEqual({ a: 1 })
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
      
      getValue() {
        return this.subs
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
    governor.flush()
    expect(didUpdateCallCount).toBe(2)
    expect(governor.getValue()).toEqual({ a: 2 })
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
          a: subscribe(counter)
        })
      }
      
      getValue() {
        return {
          a: this.subs.a.count
        }
      }
		
			componentDidUpdate(prevProps, prevState, prevSubs) {
        didUpdateCallCount += 1
        if (this.subs.a.count === 0) {
          counter.getValue().increase()
        }
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    expect(didUpdateCallCount).toBe(0)
    governor.setProps({ updated: true })
    governor.flush()
    expect(didUpdateCallCount).toBe(2)
    expect(governor.getValue()).toEqual({ a: 1 })
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
      
      getValue() {
        return this.subs
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
    governor.flush()
    expect(latest).toEqual({ a: 2 })
  })

  it("shouldComponentUpdate can prevent updates", () => {
    class TestComponent extends Component<{ updated }> {
      shouldComponentUpdate() {
        return false
      }
      
      getValue() {
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

  it("shouldComponentUpdate receives old state and props", () => {
    let state, props
    let nextState, nextProps

    class TestComponent extends Component<{ updated }> {
      state = { x: 1 }

      componentWillReceiveProps(nextProps) {
        this.setState({
          x: 2
        })
      }

      shouldComponentUpdate(prevProps, prevState) {
        state = prevState
        props = prevProps
        nextState = this.state
        nextProps = this.props
        return false
      }
      
      getValue() {
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
        subscribe() {
          return {
            a: 1
          }
        }
        
        getValue() {
          return this.subs
        }
      }

      createGovernor(createElement(TestComponent))
    }).toThrow()
  })

  it("child components with shouldComponentUpdate: false still appear in the parent after setting parent props", () => {
    class TestChildComponent extends Component {
      shouldComponentUpdate(prevProps, prevState) {
        return false
      }
      
      getValue() {
        return "hello"
      }
    }

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          test: createElement(TestChildComponent)
        })
      }

      getValue() {
        return {
          child: this.subs,
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
      subscribe() {
        let children = { a: subscribe(observable), b: subscribe(observable) }
        if (this.props.updated) delete children.b
        return combine(children)
      }
      getValue() {
        return this.subs
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
      getValue() {
        return "test"
      }
    }
    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine(
          this.props.updated
            ? [createElement(Child)]
            : {'0': createElement(Child)} as any
        )
      }
      getValue() {
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

      subscribe() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      getValue() {
        return this.subs
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

  it("shouldComponentUpdate receives old subs", () => {
    let subject = new OutletSubject(1)
    let outlet = new Outlet(subject)
    let shouldComponentUpdateValue

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      shouldComponentUpdate(prevProps, prevState, prevSubs) {
        shouldComponentUpdateValue = prevSubs.inner !== this.subs.inner
      }

      getValue() {
        return this.subs
      }
    }

    let governor = createGovernor(createElement(TestComponent))
    subject.next(2)
    expect(shouldComponentUpdateValue).toEqual(true)
  })

  it("events can be received from combined <subscribe /> elements in the same transaction as a setState", () => {
    let subject = new OutletSubject(1)
    let outlet = new Outlet(subject)

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combine({
          inner: subscribe(outlet)
        })
      }

      getValue() {
        return {
          child: this.subs,
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
})
