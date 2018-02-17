import { map, subscribe, combine, createElement, instantiate, Outlet, Component, SFC, StrictComponent } from '../src'
import { createModelClass } from './utils/createModelClass'

describe('Batching', () => {
  function FirstName(props: { userOutlet: Outlet<{ firstName: string, lastName: string }> }) {
    return map(
      subscribe(props.userOutlet),
      state => state.firstName
    )
  }

  function LastName(props: { userOutlet: Outlet<{ firstName: string, lastName: string }> }) {
    return map(
      subscribe(props.userOutlet),
      state => state.lastName
    )
  }

  class JoinedObservables extends Component<{ firstName: Outlet<string>, lastName: Outlet<string> }> {
    connectChild() {
      let { firstName, lastName } = this.props
      return combine({
        firstName: subscribe(firstName),
        lastName: subscribe(lastName),
      })
    }
    get child() {
      return this.getTypedChild(this)
    }
    publish() {
      let { firstName, lastName } = this.child
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
    let userOutlet = instantiate(
      map(
        subscribe(modelGovernor),
        model => model.value
      )
    )

    let firstNameGovernor = instantiate(createElement(FirstName, { userOutlet }))
    let lastNameGovernor = instantiate(createElement(LastName, { userOutlet }))
    let fullNameGovernor = instantiate(createElement(JoinedObservables, {
      firstName: firstNameGovernor,
      lastName: lastNameGovernor
    }))
    
    let updateCount = 0
    let lastValue = undefined as any
    fullNameGovernor.subscribe(name => {
        updateCount++
        lastValue = name
    })

    expect(updateCount).toEqual(1)
    expect(lastValue).toEqual(' ')

    modelGovernor.transactionStart('1')
    modelGovernor.getValue().change({ firstName: "James", lastName: "Nelson" })
    modelGovernor.transactionEnd('1')

    expect(lastValue).toEqual('James Nelson')
    expect(updateCount).toEqual(2)
  })
})