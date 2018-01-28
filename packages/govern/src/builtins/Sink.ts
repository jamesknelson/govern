import { ComponentImplementation, ComponentLifecycle } from '../ComponentImplementation'
import { SinkProps } from '../Core'
import { createElement } from '../Element'
import { Governable } from '../Governable'

export class Sink<T> implements Governable<SinkProps<T>, T>, ComponentLifecycle<SinkProps<T>, T, {}> {
    impl: ComponentImplementation<SinkProps<T>, T, {}>;
    
    constructor(props: SinkProps<T>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return a new sink element, and
        // the ComponentImplementation class will handle it appropriately. 
        return createElement("sink", this.impl.props) as any
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
