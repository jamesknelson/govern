import * as React from 'react'
import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { Store, createStore, Subscribe, createSubscribe } from '../src'


function createTester<T>(initialValue: T) {
  class Tester extends Govern.Component {
    state = {
      value: initialValue
    }
    publish() {
      return {
        value: this.state.value,
        change: value => { this.setState({ value }) },
      }
    }
  }

  let store = Govern.instantiate(Govern.createElement(Tester))
  let transactionId

  return {
    element: Govern.map(store, x => x.value),
    next: (value) => {
      store.getValue().change(value)
    },
    dispatch: store.UNSAFE_dispatch,
  }
}


test('injects initial value', () => {
  let tester = createTester({ x: "hello" })

  let renderer = ReactTestRenderer.create(
    createStore(tester.element, store =>
      createSubscribe(store, value => value.x)   
    )
  )
  expect(renderer.toJSON()).toEqual("hello")
})

test('allows changing values', () => {
  let tester = createTester({ x: 1 })
  
  let renderer = ReactTestRenderer.create(
    createStore(tester.element, store =>
      createSubscribe(store, value => String(value.x))
    )
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.dispatch(() => {
    tester.next({ x: 2 })
  })
  expect(renderer.toJSON()).toEqual("2")
})
