import { ComponentImplementation } from '../ComponentImplementation'
import { ComponentLifecycle } from '../ComponentLifecycle'
import { CombineChildren, CombineProps } from '../Core'
import { Governable } from '../Governable'

export class Combine<T> implements Governable<CombineProps<T>, T>, ComponentLifecycle<CombineProps<T>, {}, T, T> {
    impl: ComponentImplementation<CombineProps<T>, {}, T, T>;
    
    constructor(props: CombineProps<T>) {
        this.impl = new ComponentImplementation(this, props)
    }

    subscribe() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return the children as-is, and
        // they'll be handled properly.
        return this.impl.props.children
    }

    render() {
        return this.impl.subs
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
