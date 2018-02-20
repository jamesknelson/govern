import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineArrayChildren, CombineArrayProps } from '../Core'
import { createElement } from '../Element'
import { Instantiable } from '../Instantiable'

export class CombineArray<ItemValue> implements Instantiable<CombineArrayProps<ItemValue>, ItemValue[]>, ComponentImplementationLifecycle<CombineArrayProps<ItemValue>, {}, ItemValue[], ItemValue[]> {
    impl: ComponentImplementation<CombineArrayProps<ItemValue>, {}, ItemValue[], ItemValue[]>;
    
    constructor(props: CombineArrayProps<ItemValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        return createElement('combineArray', this.impl.props)
    }

    publish() {
        return this.impl.subs
    }

    instantiate(initialTransactionId: string) {
        this.impl.transactionStart(initialTransactionId, false)
        return this.impl.createStore()
    }
}
