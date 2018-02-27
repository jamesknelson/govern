import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineChildren, CombineProps } from '../Core'
import { createElement } from '../Element'
import { Instantiable } from '../Instantiable'
import { Target } from '../Target'

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

    instantiate(initialTransactionId: string, parentTarget: Target<any> | undefined) {
        this.impl.receiveTransactionStart(initialTransactionId, parentTarget)
        return this.impl.createStore()
    }
}
