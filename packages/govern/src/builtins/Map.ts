import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../Element'
import { Instantiable } from '../Instantiable'
import { Target } from '../Target'

export class Map<FromValue, ToValue> implements Instantiable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue, FromValue> {
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, {}, ToValue, FromValue>;
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        return this.impl.props.from
    }

    publish() {
        return this.impl.props.to(this.impl.subs)
    }

    instantiate(initialTransactionId: string, parentTarget: Target<any> | undefined) {
        this.impl.transactionStart(initialTransactionId, parentTarget)
        return this.impl.createStore()
    }
}
