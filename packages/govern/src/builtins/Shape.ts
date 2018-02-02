import { ComponentImplementation } from '../ComponentImplementation'
import { ComponentLifecycle } from '../ComponentLifecycle'
import { ShapeChildren, ShapeProps } from '../Core'
import { Governable } from '../Governable'

export class Shape<O> implements Governable<ShapeProps<O>, O>, ComponentLifecycle<ShapeProps<O>, {}, O, O> {
    impl: ComponentImplementation<ShapeProps<O>, {}, O, O>;
    
    constructor(props: ShapeProps<O>) {
        this.impl = new ComponentImplementation(this, props)
    }

    compose() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return the children as-is, and
        // they'll be handled properly.
        return this.impl.props.children
    }

    render() {
        return this.impl.comp
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
