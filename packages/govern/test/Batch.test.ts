import { of as observableOf } from 'zen-observable'
import { Observable } from 'outlets'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createModelClass } from './utils/createModelClass'

describe('Batching', () => {
  class SplitObservable extends Component<{ userObservable: Observable<{ firstName: string, lastName: string }> }> {
    subscribe() {
      let { userObservable } = this.props
      return combine({
        firstName: outlet(map(subscribe(userObservable), user => user.firstName)),
        lastName: outlet(map(subscribe(userObservable), user => user.lastName)),
      })
    }
    get subs() {
      return this.getTypedSubs(this)
    }
    getValue() {
      return this.subs
    }
  }

  class JoinedObservables extends Component<{ firstName: Observable<string>, lastName: Observable<string> }> {
    subscribe() {
      let { firstName, lastName } = this.props
      return combine({
        firstName: subscribe(firstName),
        lastName: subscribe(lastName),
      })
    }
    get subs() {
      return this.getTypedSubs(this)
    }
    getValue() {
      let { firstName, lastName } = this.subs
      return firstName + ' ' + lastName
    }
  }

  it("batches multiple multiple events from the same raw observable", () => {
    let userObservable = observableOf({ firstName: "", lastName: "" })
    let splitGovernor = createGovernor(createElement(SplitObservable, { userObservable }))
    let observables = splitGovernor.getValue()
    let fullNameGovernor = createGovernor(createElement(JoinedObservables, observables))
    
    let valueCount = 0
    let lastValue = undefined as any
    fullNameGovernor.subscribe(name => {
      valueCount++
      lastValue = name
    })

    expect(valueCount).toEqual(1)
    expect(lastValue).toEqual(' ')

    splitGovernor.setProps({ userObservable: observableOf({ firstName: "James", lastName: "Nelson" }) })
    splitGovernor.flush()

    expect(lastValue).toEqual('James Nelson')
    expect(valueCount).toEqual(2)
  })

  it("batches multiple events that originate from a govern observable", () => {
    let Model = createModelClass()
    let modelGovernor = createGovernor(
      map(
        createElement(Model, { defaultValue: { firstName: "", lastName: "" } }),
        ({ value, change }) =>
          combine({
            // Convert the output of the model into an observable.
            valueObservable: outlet(value),
            change: change,
          })
        )
    )
    let { valueObservable: userObservable, change } = modelGovernor.getValue()

    let splitGovernor = createGovernor(createElement(SplitObservable, { userObservable }))
    let observables = splitGovernor.getValue()
    let fullNameGovernor = createGovernor(createElement(JoinedObservables, observables))
    
    let updateCount = 0
    let lastValue = undefined as any
    fullNameGovernor.subscribe(name => {
        updateCount++
        lastValue = name
    })

    expect(updateCount).toEqual(1)
    expect(lastValue).toEqual(' ')

    change({ firstName: "James", lastName: "Nelson" })

    expect(updateCount).toEqual(2)
    expect(lastValue).toEqual('James Nelson')
  })
})