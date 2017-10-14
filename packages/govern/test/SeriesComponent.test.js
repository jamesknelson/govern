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
})