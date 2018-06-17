import { flatMap, map, combine, constant, createElement, instantiate, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'
import { createCounter, createCounterClass } from './utils/createCounter';

describe('FlatMap', () => {
  class Double extends Component<{x: number}> {
    publish() {
        return this.props.x*2
    }
  }

  it("maps initial value", () => {
    class Test extends Component<{a: string}> {
      publish() {
          return { b: this.props.a }
      }
    }

    let element = flatMap(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let store = instantiate(element)
    let harness = createTestHarness(store)

    expect(harness.value).toEqual({ c: 'test' })
  })

  it("accepts changes to from element's props", () => {
    let element = flatMap(
        createElement(Double, { x: 1 }),
        x => combine({ x: createElement(Double, { x }) })
    )
    let store = instantiate(element)
    let harness = createTestHarness(store)
    expect(harness.value).toEqual({ x: 4 })
    harness.dispatch(() => {
      harness.setProps({
          from: createElement(Double, { x: 2 }),
          to: x => combine({ x: createElement(Double, { x }) })
      })
      expect(harness.value).toEqual({ x: 4 })
    })
    expect(harness.value).toEqual({ x: 8 })
  })

  it("accepts changes to map fn", () => {
    let element = flatMap(
        createElement(Double, { x: 1 }),
        output => combine({ x: createElement(Double, { x: output }) }),
    )
    let store = instantiate(element)
    let harness = createTestHarness(store)
    expect(harness.value).toEqual({ x: 4 })
    harness.dispatch(() => {
      harness.setProps({
          from: createElement(Double, { x: 1 }),
          to: output => combine({ x: createElement(Double, { x: output*2 }) }),
      })
      expect(harness.value).toEqual({ x: 4 })
    })
    expect(harness.value).toEqual({ x: 8 })
  })

  it("passes changes on subscribed from element", () => {
    function PickFirstName(props: { name: { firstName: string, lastName: string } }) {
      return props.name.firstName
    }

    let Model = createModelClass()
    let model = instantiate(
        createElement(Model, { defaultValue: { firstName: "", lastName: "" } })
    )
    let store = instantiate(
      flatMap(
        model,
        model => createElement(PickFirstName, { name: model.value })
      )
    )
    let harness = createTestHarness(store)
    expect(harness.value).toEqual("")
    harness.dispatch(() => {
      model.getValue().change({ firstName: 'James', lastName: 'Nelson' })
    })
    expect(harness.value).toEqual('James')
  })

  it("allows actions on `from` to be called when parent is in dispatch", () => {
    let counterStore = createCounter()
    
    class TestComponent extends Component {
      subscribe() {
        return combine({
          decrease: flatMap(counterStore, value => constant(value.increase)),
          count: flatMap(counterStore, value => constant(0-value.count))
        })
      }

      publish() {
        return this.subs
      }
    }

    let harness = createTestHarness(instantiate(createElement(TestComponent)))
    expect(harness.value.count).toEqual(0)
    harness.dispatch(() => {
      harness.value.decrease()
    })
    expect(harness.value.count).toEqual(-1)

    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })

  it("allows actions on `to` to be called when parent is in dispatch", () => {
    let Counter = createCounterClass()

    class TestComponent extends Component {
      subscribe() {
        return flatMap(constant(createElement(Counter)), value => value)
      }

      publish() {
        return this.subs
      }
    }

    let harness = createTestHarness(instantiate(createElement(TestComponent)))
    expect(harness.value.count).toEqual(0)
    harness.dispatch(() => {
      harness.value.increase()
    })
    expect(harness.value.count).toEqual(1)
    harness.setProps({ updated: true })
    expect(harness.value.count).toEqual(1)

    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })

  it("transactions on flat-mapped elements complete as expected", () => {
    let counter = createCounter(1)
    let Counter = createCounterClass()

    class TestComponent extends Component {
      subscribe() {
        return flatMap(counter, value => createElement(Counter, { initialValue: 2 }))
      }

      publish() {
        return this.subs
      }
    }

    let harness = createTestHarness(instantiate(createElement(TestComponent)))
    harness.dispatch(() => {})
    expect(harness.value.count).toEqual(2)
  })

  it("a change in `from` can cause a change in `to` element", () => {
    let selector = createCounter()
    let selectorHarness = createTestHarness(selector)
    let counters = [createCounter(1), createCounter(3)]


    class TestComponent extends Component {
      subscribe() {
        return flatMap(selector, value => counters[value.count])
      }

      publish() {
        return this.subs
      }
    }

    let harness = createTestHarness(instantiate(createElement(TestComponent)))
    expect(harness.value.count).toEqual(1)
    selectorHarness.dispatch(() => {
      selectorHarness.value.increase()
    })
    expect(harness.value.count).toEqual(3)
    harness.setProps({ updated: true })
    expect(harness.value.count).toEqual(3)
  })

  it("doesn't emit a new value when the `to` element doesn't, even if `from` changes", () => {
    let Counter = createCounterClass()

    class OddSelector extends Component<{ count: any, increase: Function }> {
      shouldComponentUpdate(nextProps) {
        return !(nextProps.count % 2)
      }

      publish() {
        return {
          count: this.props.count,
          increase: this.props.increase,
        }
      }
    }

    let oddStore = instantiate(flatMap(createElement(Counter), value => createElement(OddSelector, { count: value.count, increase: value.increase })))

    let oddUpdates = 0
    let oddHarness = createTestHarness(oddStore, () => { oddUpdates++ })
    
    expect(oddHarness.value.count).toEqual(0)

    oddHarness.dispatch(() => {
      oddHarness.value.increase()
    })
    
    expect(oddHarness.value.count).toEqual(0)
    expect(oddUpdates).toEqual(0)
    
    oddHarness.dispatch(() => {
      oddHarness.value.increase()
    })

    expect(oddHarness.value.count).toEqual(2)
    expect(oddUpdates).toEqual(1)
  })
})