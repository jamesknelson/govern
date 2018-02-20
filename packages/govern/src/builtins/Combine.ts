import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineChildren, CombineProps } from '../Core'
import { createElement } from '../Element'
import { Instantiable } from '../Instantiable'

export class Combine<CombinedValue> implements Instantiable<CombineProps<CombinedValue>, CombinedValue>, ComponentImplementationLifecycle<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue> {
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

    instantiate(initialTransactionId: string) {
        this.impl.transactionStart(initialTransactionId, false)
        return this.impl.createStore()
    }
}
