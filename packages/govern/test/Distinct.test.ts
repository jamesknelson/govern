import { distinct, combine, constant, map, createElement, createObservable, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'
import { createCounter, createCounterClass } from './utils/createCounter';

describe('Distinct', () => {
  it("doesn't emit a new value when its child value hasn't changed", () => {
    let counter = createCounter()

    function TestComponent() {
      return combine({
        count: distinct(
          map(counter, x => Math.floor(x.count / 2))
        ),
        increase: counter.getValue().increase,
      })
    }
  
    let counterUpdates = 0
    let counterHarness = createTestHarness(createElement(TestComponent), () => { counterUpdates++ })

    expect(counterUpdates).toEqual(0)

    counterHarness.dispatch(() => {
      counterHarness.value.increase()
    })

    expect(counterUpdates).toEqual(0)

    counterHarness.dispatch(() => {
      counterHarness.value.increase()
    })

    expect(counterUpdates).toEqual(1)
  })

  it("supports custom comparators via the 'by' prop", () => {
    let counter = createCounter()

    class TestComponent extends Component {
      render() {
        return combine({
          count: distinct(
            map(counter, x => Math.floor(x.count / 2)),
            () => false
          ),
          increase: counter.getValue().increase,
        })
      }
    }
  
    let counterUpdates = 0
    let counterHarness = createTestHarness(createElement(TestComponent), () => { counterUpdates++ })

    expect(counterUpdates).toEqual(0)

    counterHarness.dispatch(() => {
      counterHarness.value.increase()
    })

    expect(counterUpdates).toEqual(1)
  })
})