import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../Element'
import { Governable } from '../Governable'

export class Map<FromValue, ToValue> implements Governable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue, ToValue> {
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

    createOutlet(initialTransactionId: string) {
        this.impl.transactionStart(initialTransactionId, false)
        return this.impl.createOutlet()
    }
}
