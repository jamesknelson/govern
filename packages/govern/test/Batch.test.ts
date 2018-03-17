import { map, combine, createElement, GovernElement, instantiate, Store, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'

type ReturnType<T> = T extends (...args: any[]) => GovernElement<infer R, any> ? R : never;

describe('Batching', () => {
  function FirstName(props: { userStore: Store<{ firstName: string, lastName: string }> }) {
    return map(
      props.userStore,
      state => state.firstName
    )
  }

  function LastName(props: { userStore: Store<{ firstName: string, lastName: string }> }) {
    return map(
      props.userStore,
      state => state.lastName
    )
  }

  class JoinedObservables extends Component<{ firstName: Store<string>, lastName: Store<string> }> {
    subscribe() {
      let { firstName, lastName } = this.props
      return combine({
        firstName: firstName,
        lastName: lastName,
      })
    }
    publish() {
      let { firstName, lastName } = this.subs
      return firstName + ' ' + lastName
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
    let modelGovernor = instantiate(
        createElement(Model, { defaultValue: { firstName: "", lastName: "" } })
    )
    let userStore = instantiate(
      map(
        modelGovernor,
        model => model.value
      )
    )

    let firstNameGovernor = instantiate(createElement(FirstName, { userStore }))
    let lastNameGovernor = instantiate(createElement(LastName, { userStore }))
    
    let fullNameGovernor = instantiate(createElement(JoinedObservables, {
      firstName: firstNameGovernor,
      lastName: lastNameGovernor
    }))
    
    let updateCount = 0
    let harness = createTestHarness(fullNameGovernor, () => {
      updateCount++
    })

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