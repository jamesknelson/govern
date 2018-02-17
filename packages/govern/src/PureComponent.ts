import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class PureComponent<Props, State={}, Value=any, Child=any> extends Component<Props, State, Value, Child> {
    shouldComponentPublish(prevProps: Props, prevState: State, prevChild: Child) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevChild, this.child)
    }
}