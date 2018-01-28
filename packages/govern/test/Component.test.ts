import * as Observable from 'zen-observable'
import { map, source, sink, shape, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createCounter } from './utils/createCounter'

describe('Component', () => {
	it("calls only componentDidInstantiate on instantiation", () => {
    let calledDidInstantiateWith = undefined as any
    let didCallDidUpdate = false

		class TestComponent extends Component<{}, { a }> {
			render() {
			  return shape({
				  a: 1
			  })
			}
		
			componentDidInstantiate() {
			  calledDidInstantiateWith = this.output
			}
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
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

			render() {
			  return shape({
				  a: this.state.a
			  })
			}
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
			  didUpdateCallCount += 1
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(1)
    expect(governor.get()).toEqual({ a: 1 })
  })
  
  it("setState within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0

		class TestComponent extends Component<{ updated }, { a }> {
      state = { a: 1 }

			render() {
			  return shape({
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
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(didUpdateCallCount).toBe(2)
    expect(governor.get()).toEqual({ a: 2 })
  })

  it("children emitting values within componentDidUpdate causes another componentDidUpdate", () => {
    let didUpdateCallCount = 0
    let counter = createCounter()

		class TestComponent extends Component<{ updated }, { a }> {
      render() {
			  return shape({
          a: sink(counter).map(counter => counter.count)
        })
			}
		
			componentDidUpdate(nextProps, nextState, nextOutput) {
        didUpdateCallCount += 1
        if (nextOutput.a === 0) {
          counter.get().increase()
        }
			}
    }
    
    let governor = createGovernor(createElement(TestComponent, { updated: false }))
    governor.setProps({ updated: true })
    expect(governor.get()).toEqual({ a: 1 })
    expect(didUpdateCallCount).toBe(2)
  })
})
  