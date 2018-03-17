import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { DistinctProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, StoreGovernor } from '../StoreGovernor'
import { Target } from '../Target'

export class Distinct<Value> implements Governable<Value, DistinctProps<Value>>, ComponentImplementationLifecycle<DistinctProps<Value>, {}, Value, Value> {
    impl: ComponentImplementation<DistinctProps<Value>, {}, Value, Value>;
    
    constructor(props: DistinctProps<Value>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        return this.impl.props.children
    }

    shouldComponentUpdate(nextProps, nextState, nextSubs) {
        let comparator = this.impl.props.by || isReferenceEqual
        return !comparator(nextSubs, this.impl.fixed[0].subs)
    }

    publish() {
        return this.impl.subs
    }

    createStoreGovernor(dispatcher: Dispatcher): StoreGovernor<Value> {
        return this.impl.createStoreGovernor(dispatcher)
    }
}


function isReferenceEqual(x: any, y: any): boolean {
    return x === y
}