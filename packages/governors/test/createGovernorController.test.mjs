import assert from 'assert'

import Governor from '../src/Governor'
import { createGovernorController, isGovernorController } from '../src/GovernorController'


describe('createGovernorController', function() {
  it("creates a minimal GovernorController", function() {
    class TestController extends Governor {}

    assert(isGovernorController(createGovernorController(TestController)))
  })

  it("respects defaultProps", function() {
    class TestController extends Governor {
      output() {
        return this.props
      }
    }
    TestController.defaultProps = {
      test: 1
    }

    const controller = createGovernorController(TestController)

    assert.equal(controller.get().test, 1)
  })

  it('creates function governors', function() {
    const controller = createGovernorController(
      props => ({ number: props.number + 1 }),
      { number: 1 }
    )

    assert.equal(controller.get().number, 2)
  })

  it('creates nested series, parallel and function controllers', function() {
    class TestController extends Governor {
      output() {
        return { number: this.props.number + 1 }
      }
    }

    const controller = createGovernorController(
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