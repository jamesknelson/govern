import { createCounter, createCounterClass } from './utils/createCounter'
import { map, combine, createElement, instantiate, Component, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe('Combine', () => {
  it("outputs plain objects", () => {
    let governor = instantiate(combine({ a: 1, b: 2 }))
    expect(governor.getValue()).toEqual({ a: 1, b: 2 })
  })

  it("outputs embedded elements", () => {
    let Counter = createCounterClass()
    let outlet = instantiate(combine({
        a: createElement(Counter, null),
        b: 2
    }))
    let harness = createTestHarness(outlet)
    expect(harness.value.a.count).toEqual(0)
  })

  it("handles addition and removal of elements", () => {
    let Counter = createCounterClass()
    let outlet = instantiate<any, any>(combine({
        a: createElement(Counter, null),
    }))
    let harness = createTestHarness(outlet)

    harness.setProps({
        children: {
            b: createElement(Counter, null)
        }
    })
    expect(harness.value.a).toEqual(undefined)
    expect(harness.value.b.count).toEqual(0)
  })

  it("handles changing of child props", () => {
    let instantiationCount = 0

    class Double extends Component<{x: number}> {
        constructor(props) {
            super(props)
            instantiationCount++
        }

        publish() {
            return this.props.x*2
        }
    }

    let outlet = instantiate(combine({
        doubled: createElement(Double, { x: 2 }),
    }))
    let harness = createTestHarness(outlet)
    expect(harness.value).toEqual({ doubled: 4 })
    harness.setProps({
        children: {
            doubled: createElement(Double, { x: 4 }),
        }
    })
    expect(instantiationCount).toEqual(1)
    expect(harness.value).toEqual({ doubled: 8 })
  })
})