import { createCounter, createCounterClass } from './utils/createCounter'
import { combine, createElement, instantiate, Component, SFC, constant } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe('Combine', () => {
  it("outputs plain objects", () => {
    let governor = instantiate(combine({ a: 1, b: 2 }))
    expect(governor.getValue()).toEqual({ a: 1, b: 2 })
  })

  it("outputs embedded elements", () => {
    let Counter = createCounterClass()
    let harness = createTestHarness(combine({
        a: createElement(Counter, null),
        b: 2
    }))
    expect(harness.value.a.count).toEqual(0)
  })

  it("handles addition and removal of elements", () => {
    let Counter = createCounterClass()
    let harness = createTestHarness<any>(combine({
        a: createElement(Counter, null),
    }))

    harness.changeElement(
        combine({
            b: createElement(Counter, null)
        })
    )
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

        render() {
            return constant(this.props.x*2)
        }
    }

    let harness = createTestHarness(combine({
        doubled: createElement(Double, { x: 2 }),
    }))
    expect(harness.value).toEqual({ doubled: 4 })
    harness.changeElement(
        combine({
            doubled: createElement(Double, { x: 4 }),
        })
    )
    expect(instantiationCount).toEqual(1)
    expect(harness.value).toEqual({ doubled: 8 })
  })
})