import { map, source, sink, shape, createElement, createGovernor, Component, SFC, Observable, StrictComponent } from '../../src'

export function createModelClass() {
    return class Model<T> extends StrictComponent<{ defaultValue: T }, { value: T, change: (value: T) => void }, any> {
        constructor(props: { defaultValue: T }) {
            super(props)
            this.state = {
                value: props.defaultValue
            }
            this.change = this.bindAction(this.change)
        }

        change(value) {
            this.setState({ value })
        }

        render() {
            return {
                value: this.state.value,
                change: this.change,
            }
        }
    }
}