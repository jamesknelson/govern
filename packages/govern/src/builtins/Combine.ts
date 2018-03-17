import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineChildren, CombineProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, StoreGovernor } from '../StoreGovernor'
import { Target } from '../Target'

export class Combine<CombinedValue> implements Governable<CombinedValue, CombineProps<CombinedValue>>, ComponentImplementationLifecycle<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue> {
    impl: ComponentImplementation<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue>;
    
    constructor(props: CombineProps<CombinedValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        return createElement('combine', this.impl.props)
    }

    publish() {
        return this.impl.subs
    }

    createStoreGovernor(dispatcher: Dispatcher): StoreGovernor<CombinedValue> {
        return this.impl.createStoreGovernor(dispatcher)
    }
}
