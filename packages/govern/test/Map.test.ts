import { map, combine, constant, createElement, instantiate, Component, SFC } from '../src'
import { createModelClass } from './utils/createModelClass'
import { createTestHarness } from './utils/createTestHarness'
import { createCounter, createCounterClass } from './utils/createCounter';

describe('Map', () => {
  class Double extends Component<{x: number}> {
    publish() {
        return this.props.x*2
    }
  }

  it("doesn't flattern the result", () => {
    class Test extends Component<{a: string}> {
      publish() {
          return { b: this.props.a }
      }
    }

    let element = map(createElement(Test, { a: 'test' }), output => combine({ c: output.b }))
    let outlet = instantiate(element)
    let harness = createTestHarness(outlet)

    expect(harness.value).toEqual(combine({ c: 'test' }))
  })
})