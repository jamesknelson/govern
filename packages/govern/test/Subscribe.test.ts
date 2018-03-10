import { createCounter } from './utils/createCounter'
import { flatMap, combine, constant, createElement, instantiate, Component, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe("Subscribing to governors", () => {
    it("outputs intial value", () => {
        let Component = () => constant('blue')
        let store1 = instantiate(createElement(Component))
        let TestComponent = () => store1
        let mainStore = instantiate(createElement(TestComponent))
        let harness = createTestHarness(mainStore)
        expect(harness.value).toEqual("blue")
    })

    it("outputs changes in value", () => {
        let counter = createCounter()
        let TestComponent = () => counter
        let store = instantiate(createElement(TestComponent))
        let harness = createTestHarness(store)
        expect(harness.value.count).toEqual(0)
        harness.dispatch(() => {
            harness.value.increase()
        })
        expect(harness.value.count).toEqual(1)
    })

    it("can change store", () => {
        let Component1 = () => constant('blue')
        let store1 = instantiate(createElement(Component1))

        let Component2 = () => constant('orange')
        let store2 = instantiate(createElement(Component2))
        
        let Subscribe = ({ to }) => to
        let mainStore = instantiate(createElement(Subscribe, { to: store1 }))
        let harness = createTestHarness(mainStore)
        expect(harness.value).toEqual("blue")
        harness.setProps({ to: store2 })
        expect(harness.value).toEqual("orange")
    })
})