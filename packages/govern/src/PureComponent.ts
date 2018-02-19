import { Component } from './Component'
import { shallowCompare } from './utils/shallowCompare'

export abstract class PureComponent<Props, State={}, Value=any, Subs=any> extends Component<Props, State, Value, Subs> {
    shouldComponentPublish(prevProps: Props, prevState: State, prevSubs: Subs) {
        return !shallowCompare(prevProps, this.props) || !shallowCompare(prevState, this.state) || !shallowCompare(prevSubs, this.subs)
    }
}