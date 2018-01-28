import { of as observableOf } from 'zen-observable'
import { map, source, sink, shape, createElement, createGovernor, Component, SFC, Observable, StrictComponent } from '../src'
import { createModelClass } from './utils/createModelClass'

describe('Batch', () => {
  function SplitObservable({ userObservable }: { userObservable: Observable<{ firstName: string, lastName: string }> }) {
    return shape({
      firstName: source(sink(userObservable).map(user => user.firstName)),
      lastName: source(sink(userObservable).map(user => user.lastName)),
    })
  }

  function JoinedObservables({ firstName, lastName }: { firstName: Observable<string>, lastName: Observable<string> }) {
    return shape({
      firstName: sink(firstName),
      lastName: sink(lastName),
    }).map(({ firstName, lastName }) => {
      return firstName + ' ' + lastName
    })
  }

  it("doesn't batch multiple events from the same raw observable", () => {
    let userObservable = observableOf({ firstName: "", lastName: "" })
    let splitGovernor = createGovernor(createElement(SplitObservable, { userObservable }))
    let observables = splitGovernor.get()
    let fullNameGovernor = createGovernor(createElement(JoinedObservables, observables))
    
    let updateCount = 0
    let lastValue = undefined as any
    fullNameGovernor.subscribe(name => {
        updateCount++
        lastValue = name
    })

    expect(updateCount).toEqual(1)
    expect(lastValue).toEqual(' ')

    splitGovernor.setProps({ userObservable: observableOf({ firstName: "James", lastName: "Nelson" }) })

    expect(updateCount).toEqual(3)
    expect(lastValue).toEqual('James Nelson')
  })

  it("does batch multiple events that originate from a govern observable", () => {
    let Model = createModelClass()
    let modelGovernor = createGovernor(
      createElement(Model, { defaultValue: { firstName: "", lastName: "" } })
        .map(({ value, change }) =>
          shape({
            // Convert the output of the model into an observable.
            valueObservable: source(value),
            change: change,
          })
        )
    )
    let { valueObservable: userObservable, change } = modelGovernor.get()

    let splitGovernor = createGovernor(createElement(SplitObservable, { userObservable }))
    let observables = splitGovernor.get()
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