import * as Observable from 'zen-observable'
import { createCounter } from './utils/createCounter'
import { map, outlet, subscribe, shape, createElement, createGovernor, Component, SFC } from '../src'

describe('OutletSource', () => {
  it("outputs its initial value", () => {
    let governor = createGovernor(outlet({ a: 1, b: 2 }))
    let observable = governor.getValue()
    expect(observable.getValue()).toEqual({ a: 1, b: 2 })
  })

  it("outputs subsequent values", () => {
    let governor = createGovernor(outlet(shape({ a: 1, b: 2 })))
    let observable = governor.getValue()

    let test = Observable.of("red", "green", "blue")
    governor.setProps({ children: subscribe(test) })

    expect(observable.getValue()).toEqual("blue")
  })

  it("outputs changes to children", () => {
    let counter = createCounter()
    let governor = createGovernor(outlet(subscribe(counter)))
    let observable = governor.getValue()
    expect(observable.getValue().count).toEqual(0)
    counter.getValue().increase()
    expect(observable.getValue().count).toEqual(1)
  })
})