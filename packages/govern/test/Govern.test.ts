import { flatMap, combine, createElement, instantiate, Component, SFC } from '../src'

describe('instantiate', () => {
  it("creates stateless functional components", () => {
    const TestComponent: SFC<any, { a: number, b: number, c: number }> = ({ a, c }) => {
      return combine({
        a,
        b: 2,
        c,
      })
    }

    TestComponent.defaultProps = {
      a: 1
    }

    let element = createElement(TestComponent, { c: 3 })
    let outlet = instantiate(element)
    let output = outlet.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("create class components", () => {
    class TestComponent extends Component<any, { a: number, b: number, c: number }> {
      static defaultProps = {
        a: 1
      }

      publish() {
        return {
          a: this.props.a,
          b: 2,
          c: this.props.c,
        }
      }
    }

    let element = createElement(TestComponent, { c: 3 })
    let outlet = instantiate(element)
    let output = outlet.getValue()
    expect(output).toEqual({ a: 1, b: 2, c: 3 })
  })
})
