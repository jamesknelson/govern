import { of as observableOf } from 'zen-observable'
import { Observable } from 'outlets'
import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../src'
import { createModelClass } from './utils/createModelClass'

describe('Batch', () => {
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
      return map(
        combine({
          firstName: subscribe(firstName),
          lastName: subscribe(lastName),
        }),
        ({ firstName, lastName }) => {
          return firstName + ' ' + lastName
        }
      )
    }
    get subs() {
      return this.getTypedSubs(this)
    }
    getValue() {
      return this.subs
    }
  }

  it("doesn't batch multiple events from the same raw observable", () => {
    let userObservable = observableOf({ firstName: "", lastName: "" })
    let splitGovernor = createGovernor(createElement(SplitObservable, { userObservable }))
    let observables = splitGovernor.getValue()
    let fullNameGovernor = createGovernor(createElement(JoinedObservables, observables))
    
    let transactionCount = 0
    let lastValue = undefined as any
    let noop = () => {}
    fullNameGovernor.subscribe(
      name => { lastValue = name },
      noop,
      noop,
      noop,
      () => { transactionCount++ }
    )

    expect(transactionCount).toEqual(0)
    expect(lastValue).toEqual(' ')

    splitGovernor.setProps({ userObservable: observableOf({ firstName: "James", lastName: "Nelson" }) })
    splitGovernor.flush()

    expect(transactionCount).toEqual(2)
    expect(lastValue).toEqual('James Nelson')
  })

  it("does batch multiple events that originate from a govern observable", () => {
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