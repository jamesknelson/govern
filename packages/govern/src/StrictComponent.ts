import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class StrictComponent<Props, State={}, Value=any, Child=any> extends Component<Props, State, Value, Child> {
    constructor(props: Props) {
        // Passing { strict: true } will cause exceptions to be thrown when
        // you do dangerous looking things, like causing side effects witihn
        // componentWillReceiveProps.
        super(props, { strict: true })
    }

    shouldComponentPublish(prevProps: Props, prevState: State, prevChild: Child) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevChild, this.child)
    }
}