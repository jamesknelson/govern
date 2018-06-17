import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { CombinedValue } from '../Core'
import { createElement } from '../GovernElement'
import { Dispatcher } from '../Dispatcher'
import { Governable, GovernObservableGovernor } from '../GovernObservableGovernor'

interface CombineProps<Children extends { [name: string]: any }> {
    children: Children
}

export class Combine<Children extends { [name: string]: any }> implements Governable<CombinedValue<Children>, CombineProps<Children>>, ComponentImplementationLifecycle<CombineProps<Children>, {}, CombinedValue<Children>> {
    impl: ComponentImplementation<{ children: Children }, {}, CombinedValue<Children>>;
    
    constructor(props: CombineProps<Children>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        return createElement('combine', this.impl.props)
    }

    createObservableGovernor(dispatcher: Dispatcher): GovernObservableGovernor<CombinedValue<Children>> {
        return this.impl.createObservableGovernor(dispatcher)
    }
}
