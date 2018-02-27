import { combine, createElement, instantiate, Component, SFC } from '../../src'

export function createCounter(initialValue = 0) {
    const Counter = createCounterClass()
    return instantiate(createElement(Counter, { initialValue }))
}

export function createCounterClass() {
    return class Counter extends Component<{ initialValue }, any> {
        constructor(props) {
            super(props)
            this.state = {
                count: props.initialValue || 0,
            }
        }

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
