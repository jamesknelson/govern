import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { MapProps } from '../Core'
import { createElement } from '../GovernElement'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { Target } from '../Target'

export class Map<FromValue, ToValue> implements Governable<ToValue, MapProps<FromValue, ToValue>>, ComponentImplementationLifecycle<MapProps<FromValue, ToValue>, {}, ToValue> {
    impl: ComponentImplementation<MapProps<FromValue, ToValue>, {}, ToValue>;
    
    constructor(props: MapProps<FromValue, ToValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return this.impl.props.from as any
    }

    // This lifecycle method is only used here. Perhaps it could be removed
    // in favor of deriving Map from FlatMap/Constant, although having this
    // available results in Map being implemented from 1 component instead
    // of 3...
    getPublishedValue() {
        return this.impl.props.to(this.impl.value as any)
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
