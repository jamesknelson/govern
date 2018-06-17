import { createCounter } from './utils/createCounter'
import { createElement, createObservable } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe("Subscribing to governors", () => {
    it("outputs intial value", () => {
        let Component = () => 'blue'
        let store1 = createObservable(createElement(Component))
        let TestComponent = () => store1
        let harness = createTestHarness(createElement(TestComponent))
        expect(harness.value).toEqual("blue")
    })

    it("outputs changes in value", () => {
        let counter = createCounter()
        let TestComponent = () => counter
        let harness = createTestHarness(createElement(TestComponent))
        expect(harness.value.count).toEqual(0)
        harness.dispatch(() => {
            harness.value.increase()
        })
        expect(harness.value.count).toEqual(1)
    })

    it("can change store", () => {
        let Component1 = () => 'blue'
        let store1 = createObservable(createElement(Component1))

        let Component2 = () => 'orange'
        let store2 = createObservable(createElement(Component2))
        
        let Subscribe = ({ to }) => to
        let harness = createTestHarness(createElement(Subscribe, { to: store1 }))
        expect(harness.value).toEqual("blue")
        harness.changeElement(createElement(Subscribe, { to: store2 }))
        expect(harness.value).toEqual("orange")
    })
})