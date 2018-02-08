import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class StrictComponent<Props, State={}, Value=any, Subs=any> extends Component<Props, State, Value, Subs> {
    constructor(props: Props) {
        // Passing { strict: true } will cause exceptions to be thrown when
        // you do dangerous looking things, like causing side effects witihn
        // componentWillReceiveProps.
        super(props, { strict: true })
    }

    shouldComponentUpdate(prevProps: Props, prevState: State, prevSubs: Subs) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevSubs, this.subs)
    }
}