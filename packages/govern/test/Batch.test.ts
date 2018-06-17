import { map, combine, createElement, GovernElement, createObservable, GovernObservable, Component } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'

describe('Batching', () => {
  function FirstName(props: { userStore: GovernObservable<{ firstName: string, lastName: string }> }) {
    return map(
      props.userStore,
      state => state.firstName
    )
  }

  function LastName(props: { userStore: GovernObservable<{ firstName: string, lastName: string }> }) {
    return map(
      props.userStore,
      state => state.lastName
    )
  }

  class JoinedObservables extends Component<{ firstName: GovernObservable<string>, lastName: GovernObservable<string> }> {
    render() {
      let { firstName, lastName } = this.props
      return map(
        combine({
          firstName: firstName,
          lastName: lastName,
        }),
        ({ firstName, lastName }) => firstName + ' ' + lastName
      )
    }
  }

  /**
   * In this test, the firstName and lastName governors will both emit
   * indepentent change events. The fullName governor is subscribed to both
   * of these events, and should use transaction events to ensure that
   * that indpenendent change events on both subscriptions get batched into
   * a single output event.
   */
  it("batches multiple events that originate from the same governor", () => {
    let Model = createModelClass()
    let modelGovernor = createObservable(
        createElement(Model, { defaultValue: { firstName: "", lastName: "" } })
    )
    let userStore = createObservable(
      map(
        modelGovernor,
        model => model.value
      )
    )

    let firstNameGovernor = createObservable(createElement(FirstName, { userStore }))
    let lastNameGovernor = createObservable(createElement(LastName, { userStore }))
    
    let updateCount = 0
    let harness = createTestHarness(
      createElement(JoinedObservables, {
        firstName: firstNameGovernor,
        lastName: lastNameGovernor
      }),
      () => {
        updateCount++
      }
    )

    expect(updateCount).toEqual(0)
    expect(harness.value).toEqual(' ')

    harness.dispatch(() => {
      modelGovernor.getValue().change({ firstName: "James", lastName: "Nelson" })
    })

    expect(harness.value).toEqual('James Nelson')
    expect(updateCount).toEqual(1)

    return new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })
})