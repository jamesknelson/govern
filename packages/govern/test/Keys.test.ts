import { combine, createElement, instantiate, Component, Store, SFC } from '../src'
import { createCounter } from './utils/createCounter'
import { createTestHarness } from './utils/createTestHarness'

describe('key', () => {
  it("can be swapped between indexes without causing re-instantiation", () => {
    // class TestComponent extends Component<{}> {
    //   publish() {
    //     return {
    //       action: () => {
    //         this.setState({})
    //       }
    //     }
    //   }
    // }

    // let store = instantiate(createElement(TestComponent))
    // expect(() => {
    //   store.getValue().action()
    // }).toThrow()
  })
})