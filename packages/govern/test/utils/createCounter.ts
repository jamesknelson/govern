import { map, source, sink, shape, createElement, createGovernor, Component, SFC } from '../../src'

export function createCounter() {
    const Counter = createCounterClass()
    return createGovernor(createElement(Counter, null))
}

export function createCounterClass() {
    return class Counter extends Component<{}, { count: number, increase: Function }, any> {
        state = { count: 0 }

        increase = () => {
            this.setState(({ count }) => ({ count: count + 1 }))
        }

        render() {
            return {
                count: this.state.count,
                increase: this.increase,
            }
        }
    }
}