import { Component } from './Component'
import { GovernElement, isValidElement } from './Element'
import { Governable } from './Governable'
import { Outlet } from './Observable'
import { Sink } from './builtins/Sink'
import { OutletSource } from './builtins/OutletSource'
import { Map } from './builtins/Map'
import { Shape } from './builtins/Shape'


const BuiltInComponents = {
    map: Map,
    sink: Sink,
    outlet: OutletSource,
    shape: Shape,
}

export interface Governor<P, O> extends Outlet<O> {
    getOutlet(): Outlet<O>;
    setProps(props: P): void;
    dispose(): void;
}

export function createGovernor<P, O>(element: GovernElement<P, O>): Governor<P, O> {
    let instance: Governable<P, O>

    if (!isValidElement(element)) {
        throw new Error(`createGovernor received unexpected input "${String(element)}".`)
    }

    // Create a component instance for the element, with the specified
    // initial props.
    if (typeof element.type === "string") {
        let constructor = BuiltInComponents[element.type]
        if (!constructor) {
            throw new Error(`Unknown builtin type "${element.type}".`)
        }
        instance = new constructor(element.props)
    }
    else if (element.type.prototype.createGovernor) {
        let constructor = element.type as any
        instance = new constructor(element.props)
    }
    else if (typeof element.type === "function") {
        // Stateless functional components are currently just implemented as
        // an anonymous Component class.
        let sfc = element.type as any
        let constructor = class extends Component<any, any> {
            compose() {
                return sfc(this.props)
            }

            render() {
                return this.comp
            }
        }
        instance = new constructor(element.props)
    }
    else {
        throw new Error(`Cannot create governor of type "${String(element.type)}".`)
    }

    // Return the component instance's governor.
    return instance.createGovernor()
}
