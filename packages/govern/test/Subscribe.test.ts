import { createCounter } from './utils/createCounter'
import { map, subscribe, combine, createElement, instantiate, Component, SFC } from '../src'

describe("Subscribing to governors", () => {
    it("outputs intial value", () => {
        let Component = () => combine('blue')
        let observable = instantiate(createElement(Component))
        let governor = instantiate(subscribe(observable))
        expect(governor.getValue()).toEqual("blue")
    })

    it("outputs changes in value", () => {
        let counter = createCounter()
        let governor = instantiate(subscribe(counter))
        let value
        governor.subscribe(x => { value = x })
        expect(value.count).toEqual(0)
        counter.transactionStart('1')
        counter.getValue().increase()
        counter.transactionEnd('1')
        expect(value.count).toEqual(1)
    })

    it("can change governor", () => {
        let Component1 = () => combine('blue')
        let observable1 = instantiate(createElement(Component1))

        let Component2 = () => combine('orange')
        let observable2 = instantiate(createElement(Component2))
        
        let governor = instantiate(subscribe(observable1))
        expect(governor.getValue()).toEqual("blue")
        governor.transactionStart('1')
        governor.setProps({ to: observable2 })
        governor.transactionEnd('1')
        expect(governor.getValue()).toEqual("orange")
    })
})