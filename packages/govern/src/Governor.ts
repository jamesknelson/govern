import { Component } from './Component'
import { GovernElement, isValidElement } from './Element'
import { Governable } from './Governable'
import { Outlet } from './Observable'
import { Subscribe } from './builtins/Subscribe'
import { OutletSource } from './builtins/OutletSource'
import { Map } from './builtins/Map'
import { Combine } from './builtins/Combine'


const BuiltInComponents = {
    map: Map,
    subscribe: Subscribe,
    outlet: OutletSource,
    combine: Combine,
}

export interface Governor<Props, Value> extends Outlet<Value> {
    getOutlet(): Outlet<Value>;
    setProps(props: Props): void;
    dispose(): void;
}

export function createGovernor<Props, Value>(element: GovernElement<Props, Value>): Governor<Props, Value> {
    let instance: Governable<Props, Value>

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
            subscribe() {
                return sfc(this.props)
            }

            getValue() {
                return this.subs
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
