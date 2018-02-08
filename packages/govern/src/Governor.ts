import { Outlet } from 'outlets'
import { Component } from './Component'
import { GovernElement, isValidElement } from './Element'
import { Governable } from './Governable'
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

// This is the same object, but with some methods extra methods that aren't
// available on the external interface.
export interface InternalGovernor<Props, Value> extends Outlet<Value> {
    dispose(): void;
    flush(): void;
    getOutlet(): Outlet<Value>;
    setPropsWithoutFlush(props: Props): void;
    setProps(props: Props): void;
}

export interface Governor<Props, Value> extends Outlet<Value> {
    dispose(): void;
    getOutlet(): Outlet<Value>;
    setProps(props: Props): void;
}

export function createGovernor<Props, Value>(element: GovernElement<Props, Value>): Governor<Props, Value> {
    let instance: Governable<Props, Value>

    // Return the component instance's governor.
    let governor = internalCreateGovernor(element)
    // TODO: add `setProps`
    governor.flush()
    return governor
}

/**
 * This allows the `flushProps` method to be called manually. It is used
 * internally, but not exposed via the public API as forgetting to flush props
 * is a superb way to waste a couple hours chasing funny bugs.
 */
export function internalCreateGovernor<Props, Value>(element: GovernElement<Props, Value>): InternalGovernor<Props, Value> {
    let instance: Governable<Props, Value>

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
            connectChild() {
                return sfc(this.props)
            }

            publish() {
                return this.child
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
