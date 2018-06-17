import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../Element'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { Target } from '../Target'

export class Map<FromValue, ToValue> implements Governable<ToValue, MapProps<FromValue, ToValue>>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue, FromValue> {
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, {}, ToValue, FromValue>;
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return this.impl.props.from
    }

    getPublishedValue() {
        return this.impl.props.to(this.impl.subs)
    }

    shouldComponentPublish() {
        // We always need to publish, as the `to` function could return
        // something different even if nothing else has changed.
        return true
    }

    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<ToValue> {
        return this.impl.createObservableGovernor(dispatcher)
    }
}
