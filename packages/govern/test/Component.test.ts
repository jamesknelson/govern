import * as Observable from 'zen-observable'
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
		
			componentDidUpdate(nextProps, nextState, nextSubs) {
        didUpdateCallCount += 1
        if (nextSubs.a.count === 0) {
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
    expect(updateCount).toBe(1)
    governor.setProps({ updated: true })
    expect(updateCount).toBe(2)
    expect(latest).toEqual({ a: 2 })
  })

  it("shouldComponentUpdate can prevent updates", () => {
    class TestComponent extends Component<{ updated }> {
      shouldComponentUpdate() {
        return false
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
    expect(updateCount).toBe(1)
    governor.setProps({ updated: true })
    expect(updateCount).toBe(1)
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
})
  