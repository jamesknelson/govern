import { combine, combineArray, createElement, createObservable, map, Component, GovernObservable, SFC } from '../src'
import { createCounterClass } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('key', () => {
  it("can be swapped between indexes without causing re-instantiation", () => {
    let Counter = createCounterClass()

    class TestComponent extends Component<{ updated }> {
      render() {
        return map(
          combineArray([
            createElement(Counter, { key: this.props.updated ? 'b' : 'a' }),
            createElement(Counter, { key: this.props.updated ? 'a' : 'b' }),
          ]),
          subs => ({
            increaseFirst: () => {
              subs[0].increase()
            },
            secondCount: subs[1].count,
          })
        )
      }
    }

    let harness = createTestHarness(createElement(TestComponent))

    harness.dispatch(() => {
      harness.value.increaseFirst()
    })
    expect(harness.value.secondCount).toBe(0)
    harness.changeElement(createElement(TestComponent, { updated: true }))
    expect(harness.value.secondCount).toBe(1)
    harness.changeElement(createElement(TestComponent, { updated: false }))
    expect(harness.value.secondCount).toBe(0)
  })

  it("removes old indexes from subs", () => {
    let Counter = createCounterClass()

    class TestComponent extends Component<{ updated }> {
      render() {
        let el = combineArray((this.props.updated ? [] : [
          createElement(Counter, { key: 'a' }),
        ]).concat([
          createElement(Counter, { key: 'b' }),
        ]))
        return map(el, subs => ({
          increaseLast: () => {
            subs[1].increase()
          },
          firstCount: subs[0].count,
          secondCount: subs[1] && subs[1].count,
        }))
      }
    }

    let harness = createTestHarness(createElement(TestComponent))

    harness.dispatch(() => {
      harness.value.increaseLast()
    })
    expect(harness.value.secondCount).toBe(1)
    harness.changeElement(createElement(TestComponent, { updated: true }))
    expect(harness.value.secondCount).toBe(undefined)
    expect(harness.value.firstCount).toBe(1)
  })
})