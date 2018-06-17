import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class PureComponent<Props, State={}, Subs=any> extends Component<Props, State, Subs> {
    shouldComponentUpdate(nextProps: Props, nextState: State) {
        return !shallowCompare(nextProps, this.props) || !shallowCompare(nextState, this.state)
    }
}