import * as Observable from 'zen-observable'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC } from '../src'

describe('Map', () => {
  it("maps initial value", () => {
    class Test extends Component<{a: string}> {
      getValue() {
          return { b: this.props.a }
      }
    }

    let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let governor = createGovernor(element)

    expect(governor.getValue()).toEqual({ c: 'test' })
  })

  it("accepts changes to from element's props", () => {
    class Double extends Component<{x: number}> {
      getValue() {
          return this.props.x*2
      }
    }

    let element = map(
        createElement(Double, { x: 1 }),
        x => combine({ x: createElement(Double, { x }) })
    )
    let governor = createGovernor(element)
    expect(governor.getValue()).toEqual({ x: 4 })
    governor.setProps({
        from: createElement(Double, { x: 2 }),
        to: x => combine({ x: createElement(Double, { x }) })
    })
    expect(governor.getValue()).toEqual({ x: 8 })
  })

  it("accepts changes to map fn", () => {
    class Double extends Component<{x: number}> {
      getValue() {
          return this.props.x*2
      }
    }

    let element = map(
        createElement(Double, { x: 1 }),
        output => combine({ x: createElement(Double, { x: output }) }),
    )
    let governor = createGovernor(element)
    expect(governor.getValue()).toEqual({ x: 4 })
    governor.setProps({
        from: createElement(Double, { x: 1 }),
        to: output => combine({ x: createElement(Double, { x: output*2 }) }),
    })
    expect(governor.getValue()).toEqual({ x: 8 })
  })
})