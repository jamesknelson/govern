import assert from 'assert'

import { Component } from '../src/GovernBaseClasses'
import { createController, isGovernController } from '../src/GovernController'


describe('createController', function() {
  it("creates a minimal GovernController", function() {
    class TestController extends Component {}

    assert(isGovernController(createController(TestController)))
  })

  it("respects defaultProps", function() {
    class TestController extends Component {
      output() {
        return this.props
      }
    }
    TestController.defaultProps = {
      test: 1
    }

    const controller = createController(TestController)

    assert.equal(controller.get().test, 1)
  })

  it('creates function components', function() {
    const controller = createController(
      props => ({ number: props.number + 1 }),
      { number: 1 }
    )

    assert.equal(controller.get().number, 2)
  })

  it('creates nested series, parallel and function controllers', function() {
    class TestController extends Component {
      output() {
        return { number: this.props.number + 1 }
      }
    }

    const controller = createController(
      {
        a: [
          TestController,
          [
            TestController,
            { number: TestController },
            ({ number }) => ({ number: number.number })
          ],
          TestController,
          ({ number, letter }) => ({
            // Letter shouldn't be passed through from root, so this should
            // return number.
            number: letter ? letter : number,
          })
        ],
      },
      { number: 1, letter: 'a' }
    )

    assert.equal(controller.get().a.number, 5)
  })
})