import { ComponentImplementation } from '../ComponentImplementation'
import { ComponentLifecycle } from '../ComponentLifecycle'
import { SinkProps } from '../Core'
import { createElement } from '../Element'
import { Governable } from '../Governable'

export class Sink<T> implements Governable<SinkProps<T>, T>, ComponentLifecycle<SinkProps<T>, {}, T, T> {
    impl: ComponentImplementation<SinkProps<T>, {}, T, T>;
    
    constructor(props: SinkProps<T>) {
        this.impl = new ComponentImplementation(this, props)
    }

    compose() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return a new sink element, and
        // the ComponentImplementation class will handle it appropriately. 
        return createElement("sink", this.impl.props) as any
    }

    render() {
        return this.impl.comp
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
