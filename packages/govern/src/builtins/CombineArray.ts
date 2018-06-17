import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineArrayChildren, CombineArrayProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, StoreGovernor } from '../StoreGovernor'
import { Target } from '../Target'

export class CombineArray<ItemValue> implements Governable<ItemValue[], CombineArrayProps<ItemValue>>, ComponentImplementationLifecycle<CombineArrayProps<ItemValue>, {}, ItemValue[], ItemValue[]> {
    impl: ComponentImplementation<CombineArrayProps<ItemValue>, {}, ItemValue[], ItemValue[]>;
    
    constructor(props: CombineArrayProps<ItemValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return createElement('combineArray', this.impl.props)
    }

    createStoreGovernor(dispatcher: Dispatcher): StoreGovernor<ItemValue[]> {
        return this.impl.createStoreGovernor(dispatcher)
    }
}
