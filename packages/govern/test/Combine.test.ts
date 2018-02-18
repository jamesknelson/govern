import { createCounter, createCounterClass } from './utils/createCounter'
import { map, subscribe, combine, createElement, instantiate, Component, SFC } from '../src'

describe('Combine', () => {
  it("outputs plain objects", () => {
    let governor = instantiate(combine({ a: 1, b: 2 }))
    expect(governor.getValue()).toEqual({ a: 1, b: 2 })
  })

  it("outputs embedded elements", () => {
    let Counter = createCounterClass()
    let governor = instantiate(combine({
        a: createElement(Counter, null),
        b: 2
    }))
    expect(governor.getValue().a.count).toEqual(0)
  })

  it("handles addition and removal of elements", () => {
    let Counter = createCounterClass()
    let governor = instantiate<any, any>(combine({
        a: createElement(Counter, null),
    }))
    governor.transactionStart('1')
    governor.setProps({
        children: {
            b: createElement(Counter, null)
        }
    })
    governor.transactionEnd('1')
    expect(governor.getValue().a).toEqual(undefined)
    expect(governor.getValue().b.count).toEqual(0)
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

    let governor = instantiate(combine({
        doubled: createElement(Double, { x: 2 }),
    }))
    expect(governor.getValue()).toEqual({ doubled: 4 })
    governor.transactionStart('1')
    governor.setProps({
        children: {
            doubled: createElement(Double, { x: 4 }),
        }
    })
    governor.transactionEnd('1')
    expect(instantiationCount).toEqual(1)
    expect(governor.getValue()).toEqual({ doubled: 8 })
  })
})