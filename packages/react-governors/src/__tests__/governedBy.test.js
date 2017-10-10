import React from 'react'
import ReactTestRenderer from 'react-test-renderer'
import { Governor } from 'governors'

import governedBy from '../governedBy'


test('governedBy decorates components', () => {
  class TestComponent extends React.Component {
    render() {
      return String(this.props.number)
    }
  }
  const decorator = governedBy(props => ({ number: props.number + 1 }))
  const DecoratedComponent = decorator(TestComponent)

  const renderer = ReactTestRenderer.create(
    <DecoratedComponent number={1} />
  )

  expect(renderer.toJSON()).toEqual("2")
});