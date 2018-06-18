import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { DistinctProps } from '../Core'
import { createElement } from '../GovernElement'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { Target } from '../Target'
import { shallowCompare } from '../utils/shallowCompare'

export class Distinct<Value> implements Governable<Value, DistinctProps<Value>>, ComponentImplementationLifecycle<DistinctProps<Value>, {}, Value> {
    impl: ComponentImplementation<DistinctProps<Value>, {}, Value>;
    
    constructor(props: DistinctProps<Value>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return this.impl.props.children
    }

    shouldComponentPublish(prevProps, prevState, prevSubs) {
        let comparator = this.impl.props.by || shallowCompare
        return !comparator(prevSubs, this.impl.value)
    }

    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<Value> {
        return this.impl.createObservableGovernor(dispatcher)
    }
}
