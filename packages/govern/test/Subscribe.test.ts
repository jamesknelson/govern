import { createCounter } from './utils/createCounter'
import { map, combine, constant, createElement, instantiate, Component, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe("Subscribing to governors", () => {
    it("outputs intial value", () => {
        let Component = () => constant('blue')
        let outlet1 = instantiate(createElement(Component))
        let TestComponent = () => outlet1
        let mainOutlet = instantiate(createElement(TestComponent))
        let harness = createTestHarness(mainOutlet)
        expect(harness.value).toEqual("blue")
    })

    it("outputs changes in value", () => {
        let counter = createCounter()
        let TestComponent = () => counter
        let outlet = instantiate(createElement(TestComponent))
        let harness = createTestHarness(outlet)
        expect(harness.value.count).toEqual(0)
        harness.dispatch(() => {
            harness.value.increase()
        })
        expect(harness.value.count).toEqual(1)
    })

    it("can change governor", () => {
        let Component1 = () => constant('blue')
        let outlet1 = instantiate(createElement(Component1))

        let Component2 = () => constant('orange')
        let outlet2 = instantiate(createElement(Component2))
        
        let Subscribe = ({ to }) => to
        let mainOutlet = instantiate(createElement(Subscribe, { to: outlet1 }))
        let harness = createTestHarness(mainOutlet)
        expect(harness.value).toEqual("blue")
        harness.setProps({ to: outlet2 })
        expect(harness.value).toEqual("orange")
    })
})