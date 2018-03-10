import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, StoreGovernor } from '../StoreGovernor'
import { Target } from '../Target'

export class Map<FromValue, ToValue> implements Governable<MapProps<FromValue, ToValue>, ToValue>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue, FromValue> {
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

    createStoreGovernor(dispatcher: Dispatcher): StoreGovernor<ToValue> {
        return this.impl.createStoreGovernor(dispatcher)
    }
}
