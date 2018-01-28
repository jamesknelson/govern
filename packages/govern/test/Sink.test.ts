import * as Observable from 'zen-observable'
import { createCounter } from './utils/createCounter'
import { map, source, sink, shape, createElement, createGovernor, Component, SFC } from '../src'

describe("Sink", () => {
    it("outputs intial observable", () => {
        let observable = Observable.of("red", "green", "blue")
        let governor = createGovernor(sink(observable))
        expect(governor.get()).toEqual("blue")
    })

    it("outputs changes from observable", () => {
        let counter = createCounter()
        let governor = createGovernor(sink(counter))
        expect(governor.get().count).toEqual(0)
        counter.get().increase()
        expect(governor.get().count).toEqual(1)
    })

    it("can change observable", () => {
        let observable1 = Observable.of("red", "green", "blue")
        let observable2 = Observable.of("purple", "orange")
        let governor = createGovernor(sink(observable1))
        expect(governor.get()).toEqual("blue")
        governor.setProps({ observable: observable2 })
        expect(governor.get()).toEqual("orange")
    })
})