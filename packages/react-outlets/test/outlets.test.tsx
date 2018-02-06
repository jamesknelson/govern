import * as React from 'react'
import { OutletSubject, Outlet } from 'outlets'
import * as ReactTestRenderer from 'react-test-renderer'

import { Subscribe, createSubscribe, subscribe } from '../src/Subscribe'


test('injects initial value', () => {
  let subject = new OutletSubject({ x: "hello" })
  let outlet = new Outlet(subject)

  let renderer = ReactTestRenderer.create(
    createSubscribe(outlet, value => value.x)
  )
  expect(renderer.toJSON()).toEqual("hello")
})

test('injects subsequent outputs from same outlet', () => {
  let subject = new OutletSubject({ x: 1 })
  let outlet = new Outlet(subject)

  let renderer = ReactTestRenderer.create(
    createSubscribe(outlet, value => String(value.x))
  )
  expect(renderer.toJSON()).toEqual("1")
  subject.transactionStart()
  subject.next({ x: 2 })
  subject.transactionEnd()
  expect(renderer.toJSON()).toEqual("2")
})

test("doesn't inject values mid-transaction", () => {
  let subject = new OutletSubject({ x: 1 })
  let outlet = new Outlet(subject)

  let renderer = ReactTestRenderer.create(
    createSubscribe(outlet, value => String(value.x))
  )
  expect(renderer.toJSON()).toEqual("1")
  subject.transactionStart()
  subject.next({ x: 2 })
  expect(renderer.toJSON()).toEqual("1")
})

test("doesn't render mid-transaction", () => {
  let subject = new OutletSubject({ x: 1 })
  let outlet = new Outlet(subject)

  let renderCount = 0
  let renderer = ReactTestRenderer.create(
    createSubscribe(outlet, value => {
      renderCount++
      return String(value.x)
    })
  )
  expect(renderCount).toEqual(1)
  subject.transactionStart()
  subject.next({ x: 2 })
  expect(renderCount).toEqual(1)
})

test('injects outputs from new outlets', () => {
  let initialOutlet = new Outlet(new OutletSubject({ x: 1 }))

  class Test extends React.Component {
    state = {
      outlet: initialOutlet
    }

    updateOutlet() {
      this.setState({
        outlet: new Outlet(new OutletSubject({ x: 2 }))
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

test('higher order component', () => {
  let subject = new OutletSubject({ x: 1 })
  let outlet = new Outlet(subject)

  let TestComponent = (props: { test: string }) =>
    <span>{props.test}</span>

  let Decorated = subscribe(
    (props: { outlet: Outlet<{ x: number }> }) => props.outlet,
    (value) => ({ test: String(value.x * 2) })
  )(TestComponent)

  let renderer = ReactTestRenderer.create(
    <Decorated outlet={outlet} />
  )
  expect(renderer.toJSON().children[0]).toEqual("2")
})
