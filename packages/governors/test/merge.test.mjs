import assert from 'assert'

import merge from '../src/merge'
import Governor from '../src/Governor'
import { createGovernorController } from '../src/GovernorController'


describe('merge', function() {
  it('defaults to merging over props', function() {
    class TestController extends Governor {
      output() {
        return { test1: 'OUTPUT1', test2: 'OUTPUT2' }
      }
    }

    const controller = createGovernorController(
      merge(TestController),
      { test0: 'INPUT0', test1: 'INPUT1' }
    )
    const output = controller.get()

    assert.equal(output.test0, 'INPUT0')
    assert.equal(output.test1, 'OUTPUT1')
    assert.equal(output.test2, 'OUTPUT2')
  })

  it('supports custom merge functions', function() {
    class TestController extends Governor {
      output() {
        return { test1: 'OUTPUT1', test2: 'OUTPUT2' }
      }
    }

    const controller = createGovernorController(
      merge(TestController, (props, output) => Object.assign({}, output, props)),
      { test0: 'INPUT0', test1: 'INPUT1' }
    )
    const output = controller.get()

    assert.equal(output.test0, 'INPUT0')
    assert.equal(output.test1, 'INPUT1')
    assert.equal(output.test2, 'OUTPUT2')
  })
})