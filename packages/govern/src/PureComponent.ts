import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class PureComponent<Props, State={}, Value=any, Subs=any> extends Component<Props, State, Value, Subs> {
    shouldComponentUpdate(nextProps: Props, nextState: State) {
        return !shallowCompare(nextProps, this.props) || !shallowCompare(nextState, this.state)
    }
}