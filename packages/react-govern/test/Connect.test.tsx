import * as React from 'react'
import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { connect } from '../src/Connect'


class TestController extends Govern.Component<any, any> {
  state = { value: this.props.defaultValue }

  getValue() {
    return {
      value: this.state.value,
      change: (value) => this.setState({ value })
    }
  }
}

class TestComponent extends React.Component<any> {
  render() {
    return String(this.props.value)
  }
}


test('injects initial value', () => {
  let decorator = connect(
    props => Govern.createElement(TestController, { defaultValue: props.defaultValue }),
  )
  let DecoratedComponent = decorator(TestComponent)
  let renderer = ReactTestRenderer.create(
    <DecoratedComponent defaultValue={1} />
  )
  expect(renderer.toJSON()).toEqual("1")
})

test('allows for elements as first argument', () => {
  let decorator = connect(
    Govern.createElement(TestController, { defaultValue: 1 })
  )
  let DecoratedComponent = decorator(TestComponent)
  let renderer = ReactTestRenderer.create(
    <DecoratedComponent defaultValue={1} />
  )
  expect(renderer.toJSON()).toEqual("1")
})

test('allows for components as first argument', () => {
  let decorator = connect(TestController)
  let DecoratedComponent = decorator(TestComponent)
  let renderer = ReactTestRenderer.create(
    <DecoratedComponent defaultValue={1} />
  )
  expect(renderer.toJSON()).toEqual("1")
})

test('injects subsequent outputs', () => {
  let governor = Govern.createGovernor(
    Govern.createElement(TestController, { defaultValue: 1 }),
  )
  let decorator = connect(props => Govern.subscribe(governor))
  let DecoratedComponent = decorator(TestComponent)
  let renderer = ReactTestRenderer.create(
    <DecoratedComponent defaultValue={1} />
  )
  expect(renderer.toJSON()).toEqual("1")
  governor.getValue().change(2)
  expect(renderer.toJSON()).toEqual("2")
})
