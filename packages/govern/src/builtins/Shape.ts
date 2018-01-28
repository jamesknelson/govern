import { ComponentImplementation, ComponentLifecycle } from '../ComponentImplementation'
import { ShapeChildren, ShapeProps } from '../Core'
import { Governable } from '../Governable'

export class Shape<O> implements Governable<ShapeProps<O>, O>, ComponentLifecycle<ShapeProps<O>, O, {}> {
    impl: ComponentImplementation<ShapeProps<O>, O, {}>;
    
    constructor(props: ShapeProps<O>) {
        this.impl = new ComponentImplementation(this, props)
    }

    render() {
        // As stateless functional components are implemented using the standard
        // Component implementation, we can just return the children as-is, and
        // they'll be handled properly.
        return this.impl.props.children
    }

    createGovernor() {
        return this.impl.createGovernor()
    }
}
