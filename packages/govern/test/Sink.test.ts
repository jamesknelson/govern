import * as Observable from 'zen-observable'
import { createCounter } from './utils/createCounter'
import { map, source, sink, shape, createElement, createGovernor, Component, SFC } from '../src'

describe("Sink", () => {
    it("outputs intial observable", () => {
        let observable = Observable.of("red", "green", "blue")
        let governor = createGovernor(sink(observable))
        expect(governor.getValue()).toEqual("blue")
    })

    it("outputs changes from observable", () => {
        let counter = createCounter()
        let governor = createGovernor(sink(counter))
        expect(governor.getValue().count).toEqual(0)
        counter.getValue().increase()
        expect(governor.getValue().count).toEqual(1)
    })

    it("can change observable", () => {
        let observable1 = Observable.of("red", "green", "blue")
        let observable2 = Observable.of("purple", "orange")
        let governor = createGovernor(sink(observable1))
        expect(governor.getValue()).toEqual("blue")
        governor.setProps({ from: observable2 })
        expect(governor.getValue()).toEqual("orange")
    })
})