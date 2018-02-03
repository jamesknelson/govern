import { Component } from './Component'
import { shallowCompare } from './shallowCompare'

export abstract class StrictComponent<Props, State={}, Subs=any, T=any> extends Component<Props, State, Subs, T> {
    constructor(props: Props) {
        // Passing { strict: true } ensures that error messages will be emitted
        // when `setState` is called outside of a batch.
        super(props, { strict: true })
    }

    shouldComponentUpdate(prevProps: Props, prevState: State, prevSubs: Subs) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevSubs, this.subs)
    }
}