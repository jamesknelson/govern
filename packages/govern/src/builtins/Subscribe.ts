import { ComponentImplementation, ComponentImplementationLifecycle } from '../ComponentImplementation'
import { SubscribeProps } from '../Core'
import { createElement } from '../Element'
import { Governable } from '../Governable'

export class Subscribe<T> implements Governable<SubscribeProps<T>, T>, ComponentImplementationLifecycle<SubscribeProps<T>, {}, T, T> {
    impl: ComponentImplementation<SubscribeProps<T>, {}, T, T>;
    
    constructor(props: SubscribeProps<T>) {
        this.impl = new ComponentImplementation(this, props)
    }

    connectChild() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return a new subscribe element, and
        // the ComponentImplementation class will handle it appropriately. 
        return createElement('subscribe', this.impl.props) as any
    }

    publish() {
        return this.impl.child
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
