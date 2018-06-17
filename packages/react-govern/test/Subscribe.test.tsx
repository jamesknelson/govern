import * as React from 'react'
import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { Subscribe } from '../src'


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
    store: Govern.createObservable(Govern.map(store, x => x.value)),
    next: (value) => {
      store.getValue().change(value)
    },
    dispatch: store.waitUntilNotFlushing,
  }
}


test('injects initial value', () => {
  let tester = createTester({ x: "hello" })

  let renderer = ReactTestRenderer.create(
    Subscribe.Element({
      to: tester.store,
      render: value => value.x
    })
  )
  expect(renderer.toJSON()).toEqual("hello")
})

test('injects subsequent outputs from same store', () => {
  let tester = createTester({ x: 1 })
  
  let renderer = ReactTestRenderer.create(
    Subscribe.Element({
      to: tester.store,
      render: value => String(value.x)
    })
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.dispatch(() => {
    tester.next({ x: 2 })
  })
  expect(renderer.toJSON()).toEqual("2")
})

test("doesn't inject values mid-transaction", () => {
    let tester = createTester({ x: 1 })

  let renderer = ReactTestRenderer.create(
    Subscribe.Element({
      to: tester.store,
      render: value => String(value.x)
    })
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.dispatch(() => {
    tester.next({ x: 2 })
    expect(renderer.toJSON()).toEqual("1")
  })
})

test("doesn't render mid-transaction", () => {
    let tester = createTester({ x: 1 })

  let renderCount = 0
  let renderer = ReactTestRenderer.create(
    Subscribe.Element({
      to: tester.store,
      render: value => {
        renderCount++
        return String(value.x)
      }
    })
  )
  expect(renderCount).toEqual(1)
  tester.dispatch(() => {
    tester.next({ x: 2 })
    expect(renderCount).toEqual(1)
  })
})

test('injects outputs from new stores', () => {
  let initialOutlet = createTester({ x: 1 }).store

  class Test extends React.Component {
    state = {
      store: initialOutlet
    }

    updateOutlet() {
      this.setState({
        store: createTester({ x: 2 }).store
      })
    }

    render() {
      return Subscribe.Element({
        to: this.state.store,
        render: value => String(value.x)
      })
    }
  }

  let renderer = ReactTestRenderer.create(<Test />)
  expect(renderer.toJSON()).toEqual("1")

  renderer.getInstance().updateOutlet()
  expect(renderer.toJSON()).toEqual("2")
})
