import { createModelClass } from './utils/createModelClass'
import { map, subscribe, combine, createElement, instantiate, Component, SFC } from '../src'

describe('Map', () => {
  // it("maps initial value", () => {
  //   class Test extends Component<{a: string}> {
  //     publish() {
  //         return { b: this.props.a }
  //     }
  //   }

  //   let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
  //   let governor = instantiate(element)

  //   expect(governor.getValue()).toEqual({ c: 'test' })
  // })

  // it("accepts changes to from element's props", () => {
  //   class Double extends Component<{x: number}> {
  //     publish() {
  //         return this.props.x*2
  //     }
  //   }

  //   let element = map(
  //       createElement(Double, { x: 1 }),
  //       x => combine({ x: createElement(Double, { x }) })
  //   )
  //   let governor = instantiate(element)
  //   let value
  //   governor.subscribe(x => { value = x })
  //   expect(value).toEqual({ x: 4 })
  //   governor.transactionStart('1')
  //   governor.setProps({
  //       from: createElement(Double, { x: 2 }),
  //       to: x => combine({ x: createElement(Double, { x }) })
  //   })
  //   expect(value).toEqual({ x: 4 })
  //   governor.transactionEnd('1')
  //   expect(value).toEqual({ x: 8 })
  // })

  // it("accepts changes to map fn", () => {
  //   class Double extends Component<{x: number}> {
  //     publish() {
  //         return this.props.x*2
  //     }
  //   }

  //   let element = map(
  //       createElement(Double, { x: 1 }),
  //       output => combine({ x: createElement(Double, { x: output }) }),
  //   )
  //   let governor = instantiate(element)
  //   let value
  //   governor.subscribe(x => { value = x })
  //   expect(value).toEqual({ x: 4 })
  //   governor.transactionStart('1')
  //   governor.setProps({
  //       from: createElement(Double, { x: 1 }),
  //       to: output => combine({ x: createElement(Double, { x: output*2 }) }),
  //   })
  //   expect(value).toEqual({ x: 4 })
  //   governor.transactionEnd('1')
  //   expect(value).toEqual({ x: 8 })
  // })

  it("passes changes on subscribed from element", () => {
    let Model = createModelClass()
    let model = instantiate(
        createElement(Model, { defaultValue: { firstName: "", lastName: "" } })
    )
    let outlet = instantiate(
      map(
        subscribe(model),
        model => model.value
      )
    )

    let value
    outlet.subscribe(x => { value = x })
    expect(value).toEqual({ firstName: "", lastName: "" })
    model.transactionStart('1')
    model.getValue().change({ firstName: 'James', lastName: 'Nelson' })
    model.transactionEnd('1')
    expect(value).toEqual({ firstName: 'James', lastName: 'Nelson' })
  })
})