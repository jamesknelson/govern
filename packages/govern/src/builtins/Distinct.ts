import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { DistinctProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { Target } from '../Target'

export class Distinct<Value> implements Governable<Value, DistinctProps<Value>>, ComponentImplementationLifecycle<DistinctProps<Value>, {}, Value, Value> {
    impl: ComponentImplementation<DistinctProps<Value>, {}, Value, Value>;
    
    constructor(props: DistinctProps<Value>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return this.impl.props.children
    }

    shouldComponentPublish(prevProps, prevState, prevSubs) {
        let comparator = this.impl.props.by || isReferenceEqual
        return !comparator(prevSubs, this.impl.subs)
    }

    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<Value> {
        return this.impl.createObservableGovernor(dispatcher)
    }
}


function isReferenceEqual(x: any, y: any): boolean {
    return x === y
}