import * as Observable from 'zen-observable'
import { createCounter } from './utils/createCounter'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC } from '../src'

describe("Subscribe", () => {
    it("outputs intial observable", () => {
        let observable = Observable.of("red", "green", "blue")
        let governor = createGovernor(subscribe(observable))
        expect(governor.getValue()).toEqual("blue")
    })

    it("outputs changes from observable", () => {
        let counter = createCounter()
        let governor = createGovernor(subscribe(counter))
        expect(governor.getValue().count).toEqual(0)
        counter.getValue().increase()
        expect(governor.getValue().count).toEqual(1)
    })

    it("can change observable", () => {
        let observable1 = Observable.of("red", "green", "blue")
        let observable2 = Observable.of("purple", "orange")
        let governor = createGovernor(subscribe(observable1))
        expect(governor.getValue()).toEqual("blue")
        governor.setProps({ to: observable2 })
        expect(governor.getValue()).toEqual("orange")
    })
})