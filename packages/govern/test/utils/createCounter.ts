import { map, subscribe, combine, createElement, instantiate, Component, SFC } from '../../src'

export function createCounter() {
    const Counter = createCounterClass()
    return instantiate(createElement(Counter, null))
}

export function createCounterClass() {
    return class Counter extends Component<{}, any> {
        state = { count: 0 }

        increase = () => {
            this.setState(({ count }) => ({ count: count + 1 }))
        }

        publish() {
            return {
                count: this.state.count,
                increase: this.increase,
            }
        }
    }
}
