import { map, subscribe, combine, createElement, instantiate, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'

describe('Map', () => {
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

    let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let outlet = instantiate(element)
    let harness = createTestHarness(outlet)

    expect(harness.value).toEqual({ c: 'test' })
  })

  it("accepts changes to from element's props", () => {
    let element = map(
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
    let element = map(
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
      map(
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
})