import { map, outlet, subscribe, combine, createElement, createGovernor, Component, SFC, StrictComponent } from '../../src'

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

        publish() {
            return {
                value: this.state.value,
                change: this.change,
            }
        }
    }
}