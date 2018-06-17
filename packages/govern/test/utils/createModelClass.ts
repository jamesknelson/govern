import { combine, createElement, createObservable, Component, SFC, constant } from '../../src'

export function createModelClass() {
    return class Model<T> extends Component<{ defaultValue: T }, any> {
        constructor(props: { defaultValue: T }) {
            super(props)
            this.state = {
                value: props.defaultValue
            }
        }

        change = (value) => {
            this.setState({ value })
        }

        render() {
            return constant({
                value: this.state.value,
                change: this.change,
            })
        }
    }
}