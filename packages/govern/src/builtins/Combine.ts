import { ComponentImplementation } from '../ComponentImplementation'
import { ComponentLifecycle } from '../ComponentLifecycle'
import { CombineChildren, CombineProps } from '../Core'
import { Governable } from '../Governable'

export class Combine<CombinedValue> implements Governable<CombineProps<CombinedValue>, CombinedValue>, ComponentLifecycle<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue> {
    impl: ComponentImplementation<CombineProps<CombinedValue>, {}, CombinedValue, CombinedValue>;
    
    constructor(props: CombineProps<CombinedValue>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return the children as-is, and
        // they'll be handled properly.
        return this.impl.props.children
    }

    getValue() {
        return this.impl.subs
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
