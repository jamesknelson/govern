import { Component } from './Component'
import { shallowCompare } from './shallowCompare'

export abstract class StrictComponent<P, S={}, C=any, O=any> extends Component<P, S, C, O> {
    constructor(props: P) {
        // Passing { strict: true } ensures that error messages will be emitted
        // when `setState` is called outside of a batch.
        super(props, { strict: true })
    }

    shouldComponentUpdate(prevProps: P, prevState: S, prevComp: C) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevComp, this.comp)
    }
}