import { map, combine, constant, createElement, createObservable, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'
import { createCounter, createCounterClass } from './utils/createCounter';

describe('Map', () => {
  class Double extends Component<{x: number}> {
    render() {
      return constant(this.props.x*2)
    }
  }

  it("doesn't flattern the result", () => {
    class Test extends Component<{a: string}> {
      render() {
        return constant({ b: this.props.a })
      }
    }

    let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let harness = createTestHarness(element)

    expect(harness.value).toEqual(combine({ c: 'test' }))
  })

  it("can map to a child of a combined and flattened store", () => {
    class InnerStore extends Component {
      render() {
        return constant({
          name: 'bob'
        })
      }
    }

    class OuterStore extends Component {
      render() {
        return combine({
          inner: createElement(InnerStore)
        })
      }
    }

    function Flatten(props) {
      return props.children
    }

    let store = createObservable(createElement(OuterStore))
    let mappedElement = map(store, x => x.inner)
    let flat = createElement(Flatten, {
      children: mappedElement
    })
    let mappedStore = createObservable(flat)

    expect(mappedStore.getValue()).toEqual({ name: 'bob' })
  })
})