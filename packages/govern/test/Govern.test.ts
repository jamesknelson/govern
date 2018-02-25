import { flatMap, combine, constant, createElement, instantiate, Component, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe('instantiate', () => {
  it("creates stateless functional components", () => {
    const TestComponent: SFC<any, { a: number, b: number, c: number }> = ({ a, c }) => {
      return combine({
        a,
        b: 2,
        c,
      })
    }

    TestComponent.defaultProps = {
      a: 1
    }

    let element = createElement(TestComponent, { c: 3 })
    let store = instantiate(element)
    let output = store.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("create class components", () => {
    class TestComponent extends Component<any, { a: number, b: number, c: number }> {
      static defaultProps = {
        a: 1
      }

      publish() {
        return {
          a: this.props.a,
          b: 2,
          c: this.props.c,
        }
      }
    }

    let element = createElement(TestComponent, { c: 3 })
    let store = instantiate(element)
    let output = store.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("can be called during the end of a previous transaction", () => {
    function TestComponent(props) {
      return {
        a: props.a,
      }
    }

    let element = createElement(TestComponent, { a: 1 })
    let store = instantiate(element)
    let mapStore
    
    store.subscribe((state, dispatch) => {
      mapStore = instantiate(store.map(x => x.a))
    })

    store.transactionStart('1')
    store.setProps({ a: 2 })
    store.transactionEnd('1')

    expect(mapStore.getValue()).toBe(2)
  })
})

test("can call `dispatch` from a subscribed component, within a `dispatch` of a subscription", async () => {
  class Model<T> extends Component {
    state = { value: undefined }

    publish() {
      return {
        value: this.state.value,
        change: value => {
          this.dispatch(() => {
            this.setState({ value }) 
          })
        },
      }
    }
  }

  class TestComponent extends Component {
    subscribe() {
      return combine({
        model: createElement(Model),
      })
    }

    publish() {
      return this.subs
    }
  }

  let element = createElement(TestComponent)
  let store = instantiate(element)
  let mapStore = instantiate(store.map(x => x))
  let harness = createTestHarness(mapStore)  
  
  harness.dispatch(() => {
    harness.value.model.change('test')
  })

  expect(harness.value.model.value).toEqual('test')

  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
})
