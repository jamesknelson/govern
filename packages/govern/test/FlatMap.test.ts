import { flatMap, combine, constant, createElement, instantiate, Component, SFC } from '../src'
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
    let outlet = instantiate(element)
    let harness = createTestHarness(outlet)

    expect(harness.value).toEqual({ c: 'test' })
  })

  it("accepts changes to from element's props", () => {
    let element = flatMap(
        createElement(Double, { x: 1 }),
        x => combine({ x: createElement(Double, { x }) })
    )
    let outlet = instantiate(element)
    let harness = createTestHarness(outlet)
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
    let outlet = instantiate(element)
    let harness = createTestHarness(outlet)
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
    let outlet = instantiate(
      flatMap(
        model,
        model => createElement(PickFirstName, { name: model.value })
      )
    )
    let harness = createTestHarness(outlet)
    expect(harness.value).toEqual("")
    harness.dispatch(() => {
      model.getValue().change({ firstName: 'James', lastName: 'Nelson' })
    })
    expect(harness.value).toEqual('James')
  })

  it("allows actions on `from` to be called when parent is in dispatch", () => {
    let counterOutlet = createCounter()

    class TestComponent extends Component {
      subscribe() {
        return combine({
          decrease: flatMap(counterOutlet, value => value.increase),
          count: flatMap(counterOutlet, value => 0-value.count)
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
  })

  it("doesn't emit a new value when the `to` element doesn't, even if `from` changes", () => {
    let Counter = createCounterClass()

    class CounterWithSelector extends Component {
      subscribe() {
        return createElement(Counter)
      }

      publish() {
        return {
          count: this.subs.count + 100,
          increase: this.subs.increase,
          selectOdd: this.selectOdd,
        }
      }

      selectOdd = () =>
        createElement(OddSelector, { value: this.subs.count + 100 })
    }

    class OddSelector extends Component<{ value: any }> {
      shouldComponentPublish() {
        return !(this.props.value % 2)
      }

      publish() {
        return this.props.value
      }
    }

    let counterOutlet = instantiate(createElement(CounterWithSelector))
    let selectorOutlet = instantiate(flatMap(counterOutlet, value => value.selectOdd()))

    let counterUpdates = -1
    let counterHarness = createTestHarness(counterOutlet, () => { counterUpdates++ })

    let selectorUpdates = -1
    let selectorHarness = createTestHarness(selectorOutlet, () => { selectorUpdates++ })

    expect(selectorHarness.value).toEqual(100)

    counterHarness.dispatch(() => {
      counterHarness.value.increase()
    })

    expect(counterHarness.value.count).toEqual(101)
    expect(selectorHarness.value).toEqual(100)
    expect(selectorUpdates).toEqual(0)

    counterHarness.setProps({ updated: true })

    expect(counterHarness.value.count).toEqual(101)
    expect(selectorHarness.value).toEqual(100)
    expect(selectorUpdates).toEqual(0)

    counterHarness.dispatch(() => {
      counterHarness.value.increase()
    })

    expect(counterHarness.value.count).toEqual(102)
    expect(selectorHarness.value).toEqual(102)
    expect(counterUpdates).toEqual(3)
    expect(selectorUpdates).toEqual(1)
  })
})