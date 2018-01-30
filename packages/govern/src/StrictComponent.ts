import { Component } from './Component'
import { shallowCompare } from './shallowCompare'

export abstract class StrictComponent<P, S={}, O=any> extends Component<P, S, O> {
    constructor(props: P) {
        // Passing { strict: true } ensures that error messages will be emitted
        // when `setState` is called outside of a batch.
        super(props, { strict: true })
    }

    shouldComponentEmit(prevProps: P, prevState: S, prevOutput: O) {
        return !shallowCompare(prevOutput, this.output)
    }
}