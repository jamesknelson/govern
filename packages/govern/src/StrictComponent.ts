import { Component } from './Component'
import { shallowCompare } from './shallowCompare'

export abstract class StrictComponent<P, O, S={}> extends Component<P, O, S> {
    constructor(props: P) {
        // Passing { strict: true } ensures that error messages will be emitted
        // when `setState` is called outside of a batch.
        super(props, { strict: true })
    }

    shouldComponentEmit(prevProps, prevState, prevOutput) {
        return !shallowCompare(prevOutput, this.output)
    }
}