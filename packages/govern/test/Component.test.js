import assert from 'assert'
import sinon from 'sinon'

import { StatefulComponent } from '../src/GovernBaseClasses'


// A mock of `create` from `ComponentController.mjs`, with
// the difference that it returns the internal instance too.
function create(type, props={}) {
  const instance = new type(props)
  const controller = instance.createGovernController()
  return { controller: Object.freeze(controller), instance }
}

function createSpies() {
  const change = sinon.spy()
  const transactionStart = sinon.spy()
  const transactionEnd = sinon.spy()
  const destroy = sinon.spy()

  return { change, transactionStart, transactionEnd, destroy }
}


describe('Component', function() {
  it('checks proptypes')

  it('does not allow props to be changed', function() {
    class TestComponent extends StatefulComponent {
      constructor(props) {
        super(props)
        this.props = { test: 1 }
      }
    }

    assert.throws(() => {
      create(TestComponent)
    })
  })

  describe('#output', function() {
    it('returns state and action by default', function() {
      class TestComponent extends StatefulComponent {
        constructor(props) {
          super(props)
          this.actions = this.bindActions('test')
          this.state = { test: 1 }
        }
        test() {}
      }

      const { controller } = create(TestComponent)
      const output = controller.get()

      assert(output.actions.test instanceof Function)
      assert.equal(output.test, 1)
    })
  })

  describe('#setState', function() {
    it('updates state', function() {
      class TestComponent extends StatefulComponent {}
      const { controller, instance } = create(TestComponent)

      instance.setState({ test: 2 })
      assert.equal(instance.state.test, 2)
      instance.setState({ test: 3 })
      assert.equal(instance.state.test, 3)
    })

    it('notifies correct value', function() {
      class TestComponent extends StatefulComponent {
        output() {
          return this.state
        }
      }
      const { instance, controller } = create(TestComponent)

      const change = sinon.spy().withArgs('CHANGED')
      controller.subscribe(change)
      instance.setState({ test: 'CHANGED' })
      assert.equal(change.callCount, 1)
    })

    it('wraps notification in a transaction when necessary', function() {
      class TestComponent extends StatefulComponent {}
      const { controller, instance } = create(TestComponent)
      const spies = createSpies()

      controller.subscribe(spies.change, spies.transactionStart, spies.transactionEnd)

      assert.equal(spies.change.called, false)
      assert.equal(spies.transactionStart.called, false)
      assert.equal(spies.transactionEnd.called, false)

      instance.setState({ test: 'CHANGED' })

      assert(spies.change.calledAfter(spies.transactionStart))
      assert(spies.change.calledBefore(spies.transactionEnd))
    })

    it("doesn't start transaction when it would be unnecesssary", function() {
      const spies = createSpies()

      class TestComponent extends StatefulComponent {
        actions = this.bindActions('test')
        output() {
          return { actions: this.actions }
        }
        test() {
          assert.equal(spies.transactionStart.called, true)
          assert.equal(spies.change.called, false)
          this.setState({ value: 'CHANGED' })
        }
      }

      const { controller } = create(TestComponent)
      controller.subscribe(spies.change, spies.transactionStart)
      controller.get().actions.test()

      assert.equal(spies.transactionStart.callCount, 1)
      assert.equal(spies.change.callCount, 1)
    })
  })

  describe('actions', function() {
    it('are created via bindActions', function() {
      class TestComponent extends StatefulComponent {
        actions = this.bindActions('test')
        test() {}
        output() { return { actions: this.actions } }
      }

      const { controller } = create(TestComponent)

      assert.doesNotThrow(() => {
        controller.get().actions.test()
      })
    })

    it("doesn't start transaction when unnecessary", function() {
      const transactionStart = sinon.spy()

      class TestComponent extends StatefulComponent {
        actions = this.bindActions('test1', 'test2')

        output() {
          return { actions: this.actions }
        }
        test1() {
          assert.equal(transactionStart.callCount, 1)
          this.actions.test2()
        }
        test2() {}
      }
      const { controller } = create(TestComponent)

      controller.subscribe(() => {}, transactionStart)
      controller.get().actions.test1()

      assert.equal(transactionStart.callCount, 1)
    })

    it("doesn't call change when unnecessary", function() {
      class TestComponent extends StatefulComponent {
        actions = this.bindActions('test')

        output() {
          return { actions: this.actions }
        }
        test() {}
      }
      const { controller } = create(TestComponent)
      const change = sinon.spy()
      controller.subscribe(change)
      controller.get().actions.test()
      assert.equal(change.callCount, 0)
    })

    it("can't be called again before unlock", function() {
      const action = sinon.spy()

      class TestComponent extends StatefulComponent {
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

      class TestComponent extends StatefulComponent {
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


  describe('subcribe', function() {
    it("doesn't immediately call its callbacks", function() {
      class TestComponent extends StatefulComponent {}
      const { controller } = create(TestComponent)
      const spies = createSpies()

      controller.subscribe(spies.change, spies.transactionStart, spies.transactionEnd, spies.destroy)

      assert.equal(spies.change.called, false)
      assert.equal(spies.transactionStart.called, false)
      assert.equal(spies.transactionEnd.called, false)
      assert.equal(spies.destroy.called, false)
    })

    it("returns a working unsubscribe function", function() {
      class TestComponent extends StatefulComponent {}
      const { controller, instance } = create(TestComponent)
      const spies = createSpies()

      const unsubscribe = controller.subscribe(spies.change, spies.transactionStart, spies.transactionEnd, spies.destroy)
      unsubscribe()

      instance.setState({ test: 'CHANGED' })

      assert.equal(spies.change.called, false)
      assert.equal(spies.transactionStart.called, false)
      assert.equal(spies.transactionEnd.called, false)
    })
  })

  describe('when receiving props', function() {
    it('calls componentWillReceiveProps')

    it('enqueues a call to componentWillReceiveProps if it is already running')

    it('calls enqueued componentWillReceiveProps before calling output')

    it("respects defaultProps")

    it('executes state changes from componentWillReceiveProps before running output')

    it('starts transaction if necessary')

    it("doesn't start transaction when unnecessary")

    it("notifies subscribers")
  })

  describe('when destroyed', function() {
    it('calls componentWillBeDestroyed')

    it("notifies subscribers")
  })
})