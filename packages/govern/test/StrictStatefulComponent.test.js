import assert from 'assert'
import sinon from 'sinon'

import { StrictStatefulComponent } from '../src/GovernBaseClasses'


// A mock of `create` from `ComponentController.mjs`, with
// the difference that it returns the internal instance too.
function create(type, props={}) {
  const instance = new type(props)
  const controller = instance.createGovernController()
  return { controller: Object.freeze(controller), instance }
}


describe('StrictStatefulComponent', function() {
  describe('actions', function() {
    it("can't be called again before unlock", function() {
      const action = sinon.spy()

      class TestComponent extends StrictStatefulComponent {
        test = action
        actions = this.bindActions('test')

        output() {
          return { actions: this.actions }
        }
      }
      const { controller } = create(TestComponent)
      const actions = controller.get().actions

      actions.test()
      actions.test()

      assert.equal(action.callCount, 1)
    })

    it("can be called again after unlock", function() {
      const action = sinon.spy()

      class TestComponent extends StrictStatefulComponent {
        test = action
        actions = this.bindActions('test')

        output() {
          return { actions: this.actions }
        }
      }
      const { controller } = create(TestComponent)
      controller.subscribe(
        () => {},
        () => {},
        (unlock) => { unlock() }
      )
      const actions = controller.get().actions

      actions.test()
      actions.test()

      assert.equal(action.callCount, 2)
    })
  })
})