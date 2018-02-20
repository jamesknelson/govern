import { combine, combineArray, createElement, instantiate, Component, Store, SFC } from '../src'
import { createCounterClass } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('key', () => {
  it("can be swapped between indexes without causing re-instantiation", () => {
    let Counter = createCounterClass()

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        return combineArray([
          createElement(Counter, { key: this.props.updated ? 'b' : 'a' }),
          createElement(Counter, { key: this.props.updated ? 'a' : 'b' }),
        ])
      }

      publish() {
        return {
          increaseFirst: () => {
            this.subs[0].increase()
          },
          secondCount: this.subs[1].count,
        }
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)

    harness.dispatch(() => {
      harness.value.increaseFirst()
    })
    expect(harness.value.secondCount).toBe(0)
    harness.setProps({ updated: true })
    expect(harness.value.secondCount).toBe(1)
    harness.setProps({ updated: false })
    expect(harness.value.secondCount).toBe(0)
  })

  it("removes old indexes from subs", () => {
    let Counter = createCounterClass()

    class TestComponent extends Component<{ updated }> {
      subscribe() {
        let el = combineArray((this.props.updated ? [] : [
          createElement(Counter, { key: 'a' }),
        ]).concat([
          createElement(Counter, { key: 'b' }),
        ]))
        return el
      }

      publish() {
        return {
          increaseLast: () => {
            this.subs[1].increase()
          },
          firstCount: this.subs[0].count,
          secondCount: this.subs[1] && this.subs[1].count,
        }
      }
    }

    let store = instantiate(createElement(TestComponent))
    let harness = createTestHarness(store)

    harness.dispatch(() => {
      harness.value.increaseLast()
    })
    expect(harness.value.secondCount).toBe(1)
    harness.setProps({ updated: true })
    expect(harness.value.secondCount).toBe(undefined)
    expect(harness.value.firstCount).toBe(1)
  })
})