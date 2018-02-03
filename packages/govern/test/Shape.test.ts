import * as Observable from 'zen-observable'
import { createCounter, createCounterClass } from './utils/createCounter'
import { map, outlet, subscribe, shape, createElement, createGovernor, Component, SFC } from '../src'

describe('Shape', () => {
  it("outputs plain objects", () => {
    let governor = createGovernor(shape({ a: 1, b: 2 }))
    expect(governor.getValue()).toEqual({ a: 1, b: 2 })
  })

  it("outputs embedded elements", () => {
    let Counter = createCounterClass()
    let governor = createGovernor(shape({
        a: createElement(Counter, null),
        b: 2
    }))
    expect(governor.getValue().a.count).toEqual(0)
  })

  it("handles addition and removal of elements", () => {
    let Counter = createCounterClass()
    let governor = createGovernor<any, any>(shape({
        a: createElement(Counter, null),
    }))
    governor.setProps({
        children: {
            b: createElement(Counter, null)
        }
    })
    expect(governor.getValue().a).toEqual(undefined)
    expect(governor.getValue().b.count).toEqual(0)
  })

  it("handles changing of child props", () => {
    let Double = ({ x }: { x: number }) => x * 2

    let governor = createGovernor<any, any>(shape({
        doubled: createElement(Double, { x: 2 }),
    }))
    expect(governor.getValue()).toEqual({ doubled: 4 })
    governor.setProps({
        children: {
            doubled: createElement(Double, { x: 4 }),
        }
    })
    expect(governor.getValue()).toEqual({ doubled: 8 })
  })
})