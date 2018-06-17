import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombineChildren, CombineProps } from '../Core'
import { createElement } from '../GovernElement'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'
import { Target } from '../Target'

export class Combine<CombinedValue> implements Governable<CombinedValue, CombineProps<CombinedValue>>, ComponentImplementationLifecycle<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue> {
    impl: ComponentImplementation<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue>;
    
    constructor(props: CombineProps<CombinedValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return createElement('combine', this.impl.props)
    }

    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<CombinedValue> {
        return this.impl.createObservableGovernor(dispatcher)
    }
}
