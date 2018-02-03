import * as Observable from 'zen-observable'
import { map, outlet, sink, shape, createElement, createGovernor, Component, SFC } from '../src'

describe('Map', () => {
  it("maps initial value", () => {
    const Test = ({ a }: { a: string }) => ({ b: a })
    let element = map(createElement(Test, { a: 'test' }), output => ({ c: output.b }))
    let governor = createGovernor(element)

    expect(governor.getValue()).toEqual({ c: 'test' })
  })

  it("accepts changes to from element's props", () => {
    const Double = ({ x }: { x: number }) => ({ x: x*2 })
    let element = map(
        createElement(Double, { x: 1 }),
        Double
    )
    let governor = createGovernor(element)
    expect(governor.getValue()).toEqual({ x: 4 })
    governor.setProps({
        from: createElement(Double, { x: 2 }),
        to: Double
    })
    expect(governor.getValue()).toEqual({ x: 8 })
  })

  it("accepts changes to map fn", () => {
    const Double = ({ x }: { x: number }) => ({ x: x*2 })
    let element = map(
        createElement(Double, { x: 1 }),
        Double
    )
    let governor = createGovernor(element)
    expect(governor.getValue()).toEqual({ x: 4 })
    governor.setProps({
        from: createElement(Double, { x: 1 }),
        to: ({ x }) => ({ x: x*4 })
    })
    expect(governor.getValue()).toEqual({ x: 8 })
  })
})