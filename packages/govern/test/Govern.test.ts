import { flatMap, map, combine, createElement, createObservable, Component, SFC } from '../src'
import { createTestHarness } from './utils/createTestHarness'

describe('createObservable', () => {
  it("creates stateless functional components", () => {
    const TestComponent: SFC<{ a: number, b: number, c: number }, any> = ({ a, c }) => {
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
    let store = createObservable(element)
    let output = store.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("create class components", () => {
    class TestComponent extends Component<any, { a: number, b: number, c: number }> {
      static defaultProps = {
        a: 1
      }

      render() {
        return {
          a: this.props.a,
          b: 2,
          c: this.props.c,
        }
      }
    }

    let element = createElement(TestComponent, { c: 3 })
    let store = createObservable(element)
    let output = store.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })
})

test("can call `dispatch` from a subscribed component, within a `dispatch` of a subscription", async () => {
  class Model<T> extends Component {
    state = { value: undefined }

    render() {
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
    render() {
      return combine({
        model: createElement(Model),
      })
    }
  }

  let element = createElement(TestComponent)
  let store = createObservable(element)
  let harness = createTestHarness(map(store, x => x))
  
  harness.dispatch(() => {
    harness.value.model.change('test')
  })

  expect(harness.value.model.value).toEqual('test')

  // Wait for any exceptions thrown by the transaction checker
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
})


test("can dispose mapped items", async () => {
  class Model<T> extends Component {
    state = { value: undefined }

    render() {
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
    render() {
      return combine({
        model: createElement(Model),
      })
    }
  }

  let element = createElement(TestComponent)
  let store = createObservable(element)
  let mapStore = createObservable(map(store, x => x))

  mapStore.dispose()
})


test("children can cause their own disposal", () => {
  class Item extends Component {
    state = {
      value: undefined
    }

    render() {
      return {
        value: this.state.value,
        change: (value) => this.setState({ value })
      }
    }
  }

  class List extends Component {
    state = {
      items: {
        a: createElement(Item)
      }
    }

    render() {
      return combine(this.state.items)
    }

    componentDidUpdate() {
      if (this.subs.a && this.subs.a.value === 1) {
        this.setState({
          items: {}
        })
      }
    }
  }

  let list = createTestHarness(createElement(List))

  list.value.a.change(1)
  expect(list.value).toEqual({})
})