import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { withStore, Store, Subscribe } from '../src'


function createTester<T>(initialValue: T) {
  class Tester extends Govern.Component {
    state = {
      value: initialValue
    
    }
    render() {
      return {
        value: this.state.value,
        change: value => { this.setState({ value }) },
      }
    }
  }

  let store = Govern.createObservable(Govern.createElement(Tester))
  let transactionId

  return {
    element: Govern.map(store, x => x.value),
    next: (value) => {
      store.getValue().change(value)
    },
    dispatch: store.waitUntilNotFlushing,
  }
}


test('injects initial value', () => {
  let tester = createTester({ x: "hello" })

  let renderer = ReactTestRenderer.create(
    Store.Element({
      element: tester.element,
      render: store =>
        Subscribe.Element({
          to: store,
          children: value => value.snapshot.x
        })   
    })
  )
  expect(renderer.toJSON()).toEqual("hello")
})

test('allows changing values', () => {
  let tester = createTester({ x: 1 })
  
  let renderer = ReactTestRenderer.create(
    Store.Element({
      element: tester.element,
      render: store =>
        Subscribe.Element({
          to: store,
          render: value => String(value.snapshot.x)
        })
    })
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.dispatch(() => {
    tester.next({ x: 2 })
  })
  expect(renderer.toJSON()).toEqual("2")
})
