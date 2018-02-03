import * as Observable from 'zen-observable'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createCounter } from './utils/createCounter'

describe('Component', () => {
	it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}> {
			compose() {
			  return combine({
				  a: 1
			  })
      }

      render() {
        return this.comp
      }
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.comp
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

			compose() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      render() {
        return this.comp
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

			compose() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      render() {
        return this.comp
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
      compose() {
			  return combine({
          a: map(subscribe(counter), counter => counter.count)
        })
      }
      
      render() {
        return this.comp
      }
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
        didUpdateCallCount += 1
        if (nextOutput.a === 0) {
          counter.getValue().increase()
        }
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(governor.getValue()).toEqual({ a: 1 })
    expect(didUpdateCallCount).toBe(2)
  })

  it("setState within componentWillReceiveProps is reflected within the output", () => {
    class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			componentWillReceiveProps(nextProps) {
        this.setState({ a: 2 })
			}

			compose() {
			  return combine({
				  a: this.state.a
			  })
      }
      
      render() {
        return this.comp
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
})
  