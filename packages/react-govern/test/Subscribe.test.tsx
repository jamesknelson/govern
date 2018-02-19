
import * as React from 'react'
import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { Subscribe, createSubscribe } from '../src'


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

    let outlet = Govern.instantiate(Govern.createElement(Tester))
    let transactionId

    return {
        outlet: Govern.instantiate(Govern.map(outlet, x => x.value)),
        transactionStart: () => {
            transactionId = Govern.getUniqueId()
            outlet.transactionStart(transactionId)
        },
        next: (value) => {
            outlet.getValue().change(value)
        },
        transactionEnd: () => {
            outlet.transactionEnd(transactionId)
        }
    }
}


test('injects initial value', () => {
  let tester = createTester({ x: "hello" })

  let renderer = ReactTestRenderer.create(
    createSubscribe(tester.outlet, value => value.x)
  )
  expect(renderer.toJSON()).toEqual("hello")
})

test('injects subsequent outputs from same outlet', () => {
  let tester = createTester({ x: 1 })
  
  let renderer = ReactTestRenderer.create(
    createSubscribe(tester.outlet, value => String(value.x))
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.transactionStart()
  tester.next({ x: 2 })
  tester.transactionEnd()
  expect(renderer.toJSON()).toEqual("2")
})

test("doesn't inject values mid-transaction", () => {
    let tester = createTester({ x: 1 })

  let renderer = ReactTestRenderer.create(
    createSubscribe(tester.outlet, value => String(value.x))
  )
  expect(renderer.toJSON()).toEqual("1")
  tester.transactionStart()
  tester.next({ x: 2 })
  expect(renderer.toJSON()).toEqual("1")
})

test("doesn't render mid-transaction", () => {
    let tester = createTester({ x: 1 })

  let renderCount = 0
  let renderer = ReactTestRenderer.create(
    createSubscribe(tester.outlet, value => {
      renderCount++
      return String(value.x)
    })
  )
  expect(renderCount).toEqual(1)
  tester.transactionStart()
  tester.next({ x: 2 })
  expect(renderCount).toEqual(1)
})

test('injects outputs from new outlets', () => {
  let initialOutlet = createTester({ x: 1 }).outlet

  class Test extends React.Component {
    state = {
      outlet: initialOutlet
    }

    updateOutlet() {
      this.setState({
        outlet: createTester({ x: 2 }).outlet
      })
    }

    render() {
      return createSubscribe(this.state.outlet, value => String(value.x))
    }
  }

  let renderer = ReactTestRenderer.create(<Test />)
  expect(renderer.toJSON()).toEqual("1")

  renderer.getInstance().updateOutlet()
  expect(renderer.toJSON()).toEqual("2")
})
