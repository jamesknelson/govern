import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../Element'
import { Instantiable } from '../Instantiable'

export class Map<FromValue, ToValue> implements Instantiable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue, ToValue> {
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, {}, ToValue, ToValue>;
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        return createElement('flatMap', {
            from: this.impl.props.from,
            to: value => createElement('constant', { of: this.impl.props.to(value) }),
        })
    }

    publish() {
        return this.impl.subs
    }

    instantiate(initialTransactionId: string) {
        this.impl.transactionStart(initialTransactionId, false)
        return this.impl.createStore()
    }
}
