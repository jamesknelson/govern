import * as React from 'react'
import * as Govern from 'govern'
import * as ReactTestRenderer from 'react-test-renderer'

import { govern } from '../src/govern'


class TestController extends Govern.Component<any, any> {
  state = { value: this.props.defaultValue }

  render() {
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
  let decorator = govern(
    props => Govern.createElement(TestController, { defaultValue: props.defaultValue }),
  )
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
  let decorator = govern(props => Govern.sink(governor))
  let DecoratedComponent = decorator(TestComponent)
  let renderer = ReactTestRenderer.create(
    <DecoratedComponent defaultValue={1} />
  )
  expect(renderer.toJSON()).toEqual("1")
  governor.get().change(2)
  expect(renderer.toJSON()).toEqual("2")
})