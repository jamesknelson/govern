import assert from 'assert'
import sinon from 'sinon'

import { Component } from '../src/GovernBaseClasses'
import { createSeriesComponent } from '../src/GovernSeriesComponent'
import { createController } from '../src/GovernController'


describe('SeriesComponent', function() {
  it("instantiates right Component with output of left Component")

  it("throw errors if any passed in Components are null")

  it("doesn't pass throguh intermediate values", function() {
    class Test1 extends Component {
      output() { return { missing1: 'MISSING' } }
    }
    class Test2 extends Component {
      output() { return { present: 'PRESENT' } }
    }

    const controller = createController(
      createSeriesComponent(Test1, Test2),
      { missing0: 'MISSING' }
    )
    const output = controller.get()

    assert.equal(output.present, 'PRESENT')
    assert.equal(output.missing0, undefined)
    assert.equal(output.missing1, undefined)
  })

  it("doesn't emit when transaction starts but no changes occur", function() {
    class Test1 extends Component {}
    Test1.actions = {
      test() {}
    }

    class Test2 extends Component {
      output() {
        return { actions: this.props.actions }
      }
    }

    const controller = createController(
      createSeriesComponent(Test1, Test2)
    )

    const change = sinon.spy()
    controller.subscribe(change)
    controller.get().actions.test()
    assert.equal(change.callCount, 0)
  })

  it("when setting a subscribed Series, RHS set should only be called once", function() {
    let rhsPropsSet = 0
    class Test1 extends Component {}
    class Test2 extends Component {
      componentWillReceiveProps() {
        rhsPropsSet++
      }
    }

    const controller = createController(
      createSeriesComponent(Test1, Test2)
    )

    controller.subscribe(() => {})
    // subscribe may call set for some reason, and in this test we only want
    // to check how it is called within `controller.set`
    rhsPropsSet = 0
    controller.set({ test: 1 })
    assert.equal(rhsPropsSet, 1)
  })

  it("when setting a non-subscribed Series, LHS and RHS are not called until `get` is called", function() {
    let lhsPropsSet = 0
    let rhsPropsSet = 0
    class Test1 extends Component {
      componentWillReceiveProps() {
        lhsPropsSet++
      }
    }
    class Test2 extends Component {
      componentWillReceiveProps() {
        rhsPropsSet++
      }
    }

    const controller = createController(
      createSeriesComponent(Test1, Test2)
    )

    controller.set({ test: 1 })
    assert.equal(lhsPropsSet, 0, 'lhs set is not called after controller.set')
    assert.equal(rhsPropsSet, 0, 'rhs set is not called after controller.set')

    controller.get({ test: 1 })
    assert.equal(lhsPropsSet, 1, 'lhs set is called after controller.get')
    assert.equal(rhsPropsSet, 1, 'rhs set is called after controller.get')
  })
})