import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC } from '../../src'

export function createCounter() {
    const Counter = createCounterClass()
    return createGovernor(createElement(Counter, null))
}

export function createCounterClass() {
    return class Counter extends Component<{}, any> {
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
