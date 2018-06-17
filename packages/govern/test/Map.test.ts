import { map, combine, createElement, createObservable, Component } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe('Map', () => {
  class Double extends Component<{x: number}> {
    render() {
      return this.props.x*2
    }
  }

  it("doesn't flattern the result", () => {
    class Test extends Component<{a: string}> {
      render() {
        return { b: this.props.a }
      }
    }

    let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let harness = createTestHarness(element)

    expect(harness.value).toEqual(combine({ c: 'test' }))
  })

  it("can map to a child of a combined and flattened store", () => {
    class InnerStore extends Component {
      render() {
        return {
          name: 'bob'
        }
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