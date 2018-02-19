import { Outlet } from './Outlet'
import { Component } from './Component'
import { GovernElement, isValidElement } from './Element'
import { Governable } from './Governable'
import { FlatMap } from './builtins/FlatMap'
import { Map } from './builtins/Map'
import { Combine } from './builtins/Combine'
import { CombineArray } from './builtins/CombineArray'
import { getUniqueId } from './utils/getUniqueId'


const BuiltInComponents = {
    combine: Combine,
    combineArray: CombineArray,
    flatMap: FlatMap,
    map: Map,
}

/**
 * This allows the initial transaction to be started manually. It is used
 * internally, but not exposed via the public API, as forgetting to start
 * an initial transaction is a superb way to waste a couple hours chasing
 * funny bugs.
 */
export function instantiateWithManualFlush<Props, Value>(element: GovernElement<Props, Value>, initialTransactionId: string): Outlet<Value, Props> {
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
    else if (element.type.prototype.createOutlet) {
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

            publish() {
                return this.subs
            }
        }
        instance = new constructor(element.props)
    }
    else {
        throw new Error(`Cannot create governor of type "${String(element.type)}".`)
    }

    // Return the component instance's governor.
    return instance.createOutlet(initialTransactionId)
}

export function instantiate<Props, Value>(element: GovernElement<Props, Value>): Outlet<Value, Props> {
    let initialTransactionId = getUniqueId()
    let outlet = instantiateWithManualFlush(element, initialTransactionId)
    outlet.transactionEnd(initialTransactionId)
    return outlet
}