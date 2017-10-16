import assert from 'assert'

import merge from '../src/GovernMerge'
import { Component } from '../src/GovernBaseClasses'
import { createController } from '../src/GovernController'


describe('merge', function() {
  it('defaults to merging over props', function() {
    class TestController extends Component {
      output() {
        return { test1: 'OUTPUT1', test2: 'OUTPUT2' }
      }
    }

    const controller = createController(
      merge(TestController),
      { test0: 'INPUT0', test1: 'INPUT1' }
    )
    const output = controller.get()

    assert.equal(output.test0, 'INPUT0')
    assert.equal(output.test1, 'OUTPUT1')
    assert.equal(output.test2, 'OUTPUT2')
  })

  it('supports custom merge functions', function() {
    class TestController extends Component {
      output() {
        return { test1: 'OUTPUT1', test2: 'OUTPUT2' }
      }
    }

    const controller = createController(
      merge(TestController, (props, output) => Object.assign({}, output, props)),
      { test0: 'INPUT0', test1: 'INPUT1' }
    )
    const output = controller.get()

    assert.equal(output.test0, 'INPUT0')
    assert.equal(output.test1, 'INPUT1')
    assert.equal(output.test2, 'OUTPUT2')
  })

  it("doesn't pass throguh intermediate values", function() {
    class TestController extends Component {
      output() {
        return { test1: 'OUTPUT1', test2: 'OUTPUT2' }
      }
    }

    const controller = createController(
      merge(TestController),
      { test0: 'INPUT0', test1: 'INPUT1' }
    )
    const output = controller.get()

    assert.equal(output.props, undefined)
  })
})